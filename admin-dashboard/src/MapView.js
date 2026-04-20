import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const getColor = (level) => {
  if (level > 70) return "red";
  if (level > 40) return "orange";
  return "green";
};

const createIcon = (color) =>
  new L.DivIcon({
    html: `<div style="
      background:${color};
      width:20px;
      height:20px;
      border-radius:50%;
      border:2px solid white"></div>`,
  });

export default function MapView({ zones }) {
  return (
    <MapContainer
      center={[28.6139, 77.2090]} // Delhi (change if needed)
      zoom={15}
      style={{ height: "400px", borderRadius: "15px" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {zones.map((zone, index) => (
        <Marker
          key={zone._id}
          position={[
            28.6139 + index * 0.001,
            77.2090 + index * 0.001,
          ]}
          icon={createIcon(getColor(zone.crowdLevel))}
        >
          <Popup>
            <b>{zone.name}</b> <br />
            Crowd: {zone.crowdLevel}% <br />
            Wait: {zone.waitTime} min
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}