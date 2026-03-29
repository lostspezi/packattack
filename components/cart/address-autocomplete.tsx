"use client";

import { useState, useRef, useEffect } from "react";
import Script from "next/script";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: {
    street: string;
    city: string;
    zip: string;
    country: "DE" | "AT" | "CH";
  }) => void;
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  placeId: string;
  description: string;
  placePrediction: any;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
const VALID_COUNTRIES = new Set(["DE", "AT", "CH"]);

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  className,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [apiReady, setApiReady] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  async function fetchSuggestions(input: string) {
    if (!apiReady || input.length < 2) {
      setSuggestions([]);
      return;
    }

    const g = window as any;
    const { AutocompleteSuggestion } = g.google.maps.places;
    if (!AutocompleteSuggestion) return;

    try {
      const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(
        {
          input,
          includedRegionCodes: ["de", "at", "ch"],
          includedPrimaryTypes: ["street_address", "route", "premise"],
          language: "de",
        }
      );

      setSuggestions(
        (response.suggestions ?? []).map((s: any) => ({
          placeId: s.placePrediction.placeId,
          description: s.placePrediction.text.text,
          placePrediction: s.placePrediction,
        }))
      );
    } catch {
      setSuggestions([]);
    }
  }

  async function handleSelect(suggestion: Suggestion) {
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);

    try {
      const g = window as any;
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({ fields: ["addressComponents"] });

      const components: any[] = place.addressComponents ?? [];
      let route = "";
      let streetNumber = "";
      let city = "";
      let zip = "";
      let countryCode = "";

      for (const comp of components) {
        const type = comp.types[0];
        const long = comp.longText ?? comp.long_name ?? "";
        const short = comp.shortText ?? comp.short_name ?? "";
        if (type === "route") route = long;
        else if (type === "street_number") streetNumber = long;
        else if (type === "locality") city = long;
        else if (type === "postal_town" && !city) city = long;
        else if (type === "sublocality_level_1" && !city) city = long;
        else if (type === "postal_code") zip = long;
        else if (type === "country") countryCode = short;
      }

      const street = streetNumber ? `${route} ${streetNumber}` : route;
      const country = VALID_COUNTRIES.has(countryCode)
        ? (countryCode as "DE" | "AT" | "CH")
        : "DE";

      onChange(street);
      onPlaceSelect({ street, city, zip, country });
    } catch {
      // Place details fetch failed — keep typed value
    }
  }

  function handleInputChange(input: string) {
    onChange(input);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(input);
      setShowDropdown(true);
      setActiveIndex(-1);
    }, 250);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // No API key — render plain input
  if (!API_KEY) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&loading=async`}
        strategy="lazyOnload"
        onReady={() => setApiReady(true)}
      />
      <div ref={wrapperRef} style={{ position: "relative" }}>
        <input
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
        {showDropdown && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-surface shadow-lg">
            {suggestions.map((s, i) => (
              <li
                key={s.placeId}
                onMouseDown={() => handleSelect(s)}
                onMouseEnter={() => setActiveIndex(i)}
                className={[
                  "cursor-pointer px-3 py-2 text-sm",
                  i === activeIndex
                    ? "bg-surface-elevated text-text-primary"
                    : "text-text-secondary",
                ].join(" ")}
              >
                {s.description}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
