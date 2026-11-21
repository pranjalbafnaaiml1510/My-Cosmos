/** Research taxonomy (structure only — counts always come from the corpus). */
export const DOMAINS: { id: string; name: string; icon: string; topics: string[] }[] = [
  { id: "spacecraft", name: "Spacecraft & Systems", icon: "🛰️", topics: ["Spacecraft Systems Engineering", "Satellite Technology", "Spacecraft Structures", "Thermal Systems", "Spacecraft Power Systems"] },
  { id: "propulsion", name: "Propulsion", icon: "🚀", topics: ["Rocket Propulsion", "Electric Propulsion", "Advanced Propulsion Concepts"] },
  { id: "autonomy", name: "Autonomy & Robotics", icon: "🤖", topics: ["Autonomous Spacecraft", "Spacecraft Navigation", "Guidance and Control", "Space Robotics", "Swarm Robotics"] },
  { id: "missions", name: "Missions & Exploration", icon: "🌙", topics: ["Lunar Exploration", "Mars Exploration", "Asteroid Exploration", "Deep-Space Missions"] },
  { id: "environment", name: "Space Environment", icon: "☀️", topics: ["Space Weather", "Solar Physics", "Radiation Effects"] },
  { id: "ai", name: "AI for Space", icon: "✨", topics: ["Machine Learning", "Computer Vision", "Fault Detection", "Mission Planning", "Onboard AI"] },
  { id: "comms", name: "Communications", icon: "📡", topics: ["Deep-Space Communication", "Satellite Communication", "Remote Sensing", "Earth Observation"] },
  { id: "human", name: "Human Spaceflight", icon: "👩‍🚀", topics: ["Life-Support Systems", "Space Medicine"] },
  { id: "materials", name: "Materials & Manufacturing", icon: "🧪", topics: ["Space Materials", "In-Space Manufacturing", "Additive Manufacturing"] },
  { id: "astrobio", name: "Astrobiology", icon: "🪐", topics: ["Astrobiology", "Life Detection", "Planetary Atmospheres", "Exoplanets"] },
];

/** Country weights only shape the synthetic distribution; they are not real statistics. */
export const COUNTRIES: { id: string; name: string; flag: string; weight: number }[] = [
  { id: "us", name: "United States", flag: "🇺🇸", weight: 30 },
  { id: "cn", name: "China", flag: "🇨🇳", weight: 18 },
  { id: "in", name: "India", flag: "🇮🇳", weight: 9 },
  { id: "de", name: "Germany", flag: "🇩🇪", weight: 7 },
  { id: "gb", name: "United Kingdom", flag: "🇬🇧", weight: 6 },
  { id: "jp", name: "Japan", flag: "🇯🇵", weight: 6 },
  { id: "fr", name: "France", flag: "🇫🇷", weight: 5 },
  { id: "it", name: "Italy", flag: "🇮🇹", weight: 5 },
  { id: "ca", name: "Canada", flag: "🇨🇦", weight: 3 },
  { id: "au", name: "Australia", flag: "🇦🇺", weight: 3 },
  { id: "kr", name: "South Korea", flag: "🇰🇷", weight: 3 },
  { id: "es", name: "Spain", flag: "🇪🇸", weight: 2 },
  { id: "nl", name: "Netherlands", flag: "🇳🇱", weight: 2 },
  { id: "br", name: "Brazil", flag: "🇧🇷", weight: 1 },
];

export const MISSION_CLASSES = ["Lunar Program (demo)", "Mars Program (demo)", "Asteroid Sample Return (demo)", "Earth Observation Constellation (demo)", "Deep-Space Probe (demo)", "Space Station (demo)"];
export const METHODS = ["Deep Learning", "Reinforcement Learning", "Kalman Filtering", "Sensor Fusion", "Finite Element Analysis", "Monte Carlo Simulation", "Optimal Control", "Spectroscopy"];
export const TECHNOLOGIES = ["Optical Navigation", "Hall Thrusters", "Star Trackers", "LiDAR", "CubeSat Platforms", "Radiation Shielding", "Robotic Arms", "Laser Communication"];

export { slug } from "../../lib/slug";
