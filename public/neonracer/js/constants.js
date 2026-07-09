const CAM = {
  elevation: 1000, // Camera height above the road
  distance: 100, // Distance behind car
  fov: 90, // Field of view
};

const ROAD = {
  width: 2000,
  segmentLength: 200, // Length of one road segment
  rumbleLength: 3, // Number of segments per rumble strip color
  lanes: 3,
};

const CAR = {
  width: 80,
  height: 160,
  maxSpeed: 6000, // Max speed
  accel: 50, // Acceleration rate
  braking: -100, // Braking rate
  decel: -20, // Natural deceleration (friction)
  offRoadDecel: -100, // Friction when off-road
  offRoadLimit: 1500, // Max speed when off-road
  turnSpeed: 1000, // Turning responsiveness
};

const COLORS = {
  sky: "#0a0a2a",
  grass: "#111",
  rumbleLight: "#0ff", // Neon Cyan
  rumbleDark: "#005555",
  road: "#222",
  laneMarker: "#fff",
  carBody: "#ff0055", // Neon Pink
  plate: "#fff",
  plateText: "#000",
  fog: "#111", // Fog color
};
