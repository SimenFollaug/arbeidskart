/** Åpner Google Maps med ruteveiledning til punktet (mobil: Google Maps-app). */
export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  const destination = `${lat},${lng}`;
  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
