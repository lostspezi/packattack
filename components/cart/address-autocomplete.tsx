"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  const serviceRef = useRef<any>(null);
  const placesRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const getService = useCallback(() => {
    const g = window as any;
    if (!g.google?.maps?.places) return null;
    if (!serviceRef.current) {
      serviceRef.current = new g.google.maps.places.AutocompleteService();
    }
    if (!placesRef.current) {
      // PlacesService needs a dummy div
      placesRef.current = new g.google.maps.places.PlacesService(
        document.createElement("div")
      );
    }
    if (!sessionTokenRef.current) {
      sessionTokenRef.current =
        new g.google.maps.places.AutocompleteSessionToken();
    }
    return serviceRef.current;
  }, []);

  const fetchSuggestions = useCallback(
    (input: string) => {
      const service = getService();
      if (!service || input.length < 2) {
        setSuggestions([]);
        return;
      }

      service.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: ["de", "at", "ch"] },
          types: ["address"],
          sessionToken: sessionTokenRef.current,
        },
        (predictions: any[] | null, status: string) => {
          const g = window as any;
          if (
            status === g.google.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            setSuggestions(
              predictions.map((p) => ({
                placeId: p.place_id,
                description: p.description,
              }))
            );
          } else {
            setSuggestions([]);
          }
        }
      );
    },
    [getService]
  );

  const handleSelect = useCallback(
    (suggestion: Suggestion) => {
      if (!placesRef.current) return;

      placesRef.current.getDetails(
        {
          placeId: suggestion.placeId,
          fields: ["address_components"],
          sessionToken: sessionTokenRef.current,
        },
        (place: any, status: string) => {
          const g = window as any;
          if (status !== g.google.maps.places.PlacesServiceStatus.OK || !place)
            return;

          const components: any[] = place.address_components ?? [];
          let route = "";
          let streetNumber = "";
          let city = "";
          let zip = "";
          let countryCode = "";

          for (const comp of components) {
            const type = comp.types[0];
            if (type === "route") route = comp.long_name ?? "";
            else if (type === "street_number")
              streetNumber = comp.long_name ?? "";
            else if (type === "locality") city = comp.long_name ?? "";
            else if (type === "postal_town" && !city)
              city = comp.long_name ?? "";
            else if (type === "sublocality_level_1" && !city)
              city = comp.long_name ?? "";
            else if (type === "postal_code") zip = comp.long_name ?? "";
            else if (type === "country") countryCode = comp.short_name ?? "";
          }

          const street = streetNumber ? `${route} ${streetNumber}` : route;
          const country = VALID_COUNTRIES.has(countryCode)
            ? (countryCode as "DE" | "AT" | "CH")
            : "DE";

          // Reset session token for next search
          const gg = window as any;
          sessionTokenRef.current =
            new gg.google.maps.places.AutocompleteSessionToken();

          onChange(street);
          onPlaceSelect({ street, city, zip, country });
        }
      );

      setSuggestions([]);
      setShowDropdown(false);
      setActiveIndex(-1);
    },
    [onChange, onPlaceSelect]
  );

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
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
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
