import { ThermometerSun, Wind, MapPin } from "lucide-react";
import styles from "./CompanionWeatherCard.module.css";

type WeatherData = {
  temp: number;
  city: string;
  condition: string;
  uv: number;
  humidity: number;
  isStorm: boolean;
  windSpeed: number;
};

type CompanionWeatherCardProps = {
  weather: WeatherData;
};

export function CompanionWeatherCard({ weather }: CompanionWeatherCardProps) {
  return (
    <div className={styles.root}>
      <div className={styles.summary}>
        <div className={styles.icon}>
          <ThermometerSun />
        </div>
        <div>
          <div className={styles.temperature}>
            <strong>{weather.temp}°</strong>
            <span>{weather.condition}</span>
          </div>
          <div className={styles.location}>
            <Wind /> {weather.windSpeed} km/h • <MapPin /> {weather.city}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={styles.metric}>
          <span>UV Index</span>
          <strong>{weather.uv}</strong>
        </div>
        <div className={styles.metric}>
          <span>Umidade</span>
          <strong>{weather.humidity}%</strong>
        </div>
      </div>
    </div>
  );
}
