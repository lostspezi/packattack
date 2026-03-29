"use client";

import { useRef, useEffect } from "react";
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

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
const VALID_COUNTRIES = new Set(["DE", "AT", "CH"]);

const SHADOW_STYLES = `
  :host {
    width: 100% !important;
    display: block !important;
  }
  .LfICpf, .M7pMTc, .cGyruf, .MVBIhf {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
    min-height: unset !important;
  }
  input {
    background: transparent !important;
    color: var(--color-text-primary) !important;
    font-family: inherit !important;
    font-size: 0.875rem !important;
    line-height: 1.25rem !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    outline: none !important;
    width: 100% !important;
    box-shadow: none !important;
  }
  input::placeholder {
    color: var(--color-text-muted) !important;
  }
  .K4efff, .XmOBjc, .IEwOab, .T4LgNb {
    display: none !important;
  }
`;

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  className,
}: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  onChangeRef.current = onChange;
  onPlaceSelectRef.current = onPlaceSelect;

  const initRef = useRef(() => {
    if (initializedRef.current || !containerRef.current) return;

    const g = window as any;
    if (!g.google?.maps?.places?.PlaceAutocompleteElement) return;

    initializedRef.current = true;

    const el = new g.google.maps.places.PlaceAutocompleteElement({
      includedRegionCodes: ["de", "at", "ch"],
    });

    try {
      const shadow = el.shadowRoot;
      if (shadow) {
        const style = document.createElement("style");
        style.textContent = SHADOW_STYLES;
        shadow.appendChild(style);
      }
    } catch {
      // Shadow DOM may be closed — styling will use global CSS fallback
    }

    el.addEventListener("gmp-placeselect", (e: any) => {
      const prediction = e.placePrediction ?? e.detail?.placePrediction;
      if (!prediction) return;

      const place = prediction.toPlace();
      if (!place) return;

      place.fetchFields({ fields: ["addressComponents"] }).then(() => {
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

        onChangeRef.current(street);
        onPlaceSelectRef.current({ street, city, zip, country });
      });
    });

    if (placeholder) {
      el.setAttribute("placeholder", placeholder);
    }

    containerRef.current.appendChild(el);
    elementRef.current = el;
  });

  useEffect(() => {
    initRef.current();
    return () => {
      if (elementRef.current) {
        elementRef.current.remove();
        elementRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []);

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
        onReady={() => initRef.current()}
      />
      <div
        ref={containerRef}
        className={className}
        style={{ position: "relative" }}
      />
    </>
  );
}
