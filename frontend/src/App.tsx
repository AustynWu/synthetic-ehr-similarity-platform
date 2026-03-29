import { useEffect, useState } from "react";
import type { HealthResponse } from "./types/api";


export default function App() {
  const [status, setStatus] = useState<string>("loading...");

  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then((response) => response.json() as Promise<HealthResponse>)
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Synthetic vs Real EHR Similarity Platform</h1>
      <p>API health: {status}</p>
    </div>
  );
}