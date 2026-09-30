/** Minimal Google Maps JS typings used by Meeting Point picker. */
declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts?: object);
    panTo(latLng: LatLngLiteral): void;
    setZoom(zoom: number): void;
  }
  class Marker {
    constructor(opts?: object);
    setPosition(latLng: LatLngLiteral): void;
    setVisible(visible: boolean): void;
  }
  interface LatLngLiteral {
    lat: number;
    lng: number;
  }
  interface LatLng {
    lat(): number;
    lng(): number;
  }
  interface MapTypeStyle {
    elementType?: string;
    featureType?: string;
    stylers?: Array<Record<string, string | number>>;
  }
  interface MapsEventListener {
    remove(): void;
  }
  namespace places {
    class Autocomplete {
      constructor(input: HTMLInputElement, opts?: object);
      addListener(
        eventName: string,
        handler: () => void
      ): google.maps.MapsEventListener;
      getPlace(): {
        formatted_address?: string;
        name?: string;
        place_id?: string;
        geometry?: { location?: google.maps.LatLng };
      };
    }
  }
}

declare const google: {
  maps: typeof google.maps & {
    Map: typeof google.maps.Map;
    Marker: typeof google.maps.Marker;
    places: typeof google.maps.places;
  };
};
