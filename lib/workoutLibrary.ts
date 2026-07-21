import type { LiftExercise } from "@/lib/liftCatalog";

/**
 * Workout logger taxonomy + exercise library, ported from the product
 * prototype. Lifts are logged in sets (weight × reps); cardio in intervals
 * (minutes × miles, optionally incline %). The library is the content the
 * builder searches/filters; users can also add custom exercises at runtime.
 */

export const MUSCLES = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Legs",
  "Glutes",
  "Core",
  "Full Body",
  "Cardio"
] as const;

export type Muscle = (typeof MUSCLES)[number];
export type LiftMuscle = Exclude<Muscle, "Cardio">;

export const LIFT_MUSCLES = MUSCLES.filter((m): m is LiftMuscle => m !== "Cardio");

export type LibraryItem = {
  name: string;
  muscle: Muscle;
  /** Lift defaults. */
  w?: number;
  r?: number;
  /** Cardio defaults. */
  min?: number;
  mi?: number;
  inc?: number;
  custom?: boolean;
};

export const isCardioItem = (item: { muscle: Muscle }): boolean => item.muscle === "Cardio";

export const BASE_LIBRARY: LibraryItem[] = [
  // Chest
  { name: "Bench Press", muscle: "Chest", w: 135, r: 8 },
  { name: "Incline Bench Press", muscle: "Chest", w: 115, r: 8 },
  { name: "Decline Bench Press", muscle: "Chest", w: 135, r: 8 },
  { name: "Dumbbell Bench Press", muscle: "Chest", w: 55, r: 10 },
  { name: "Incline DB Press", muscle: "Chest", w: 50, r: 10 },
  { name: "Dumbbell Fly", muscle: "Chest", w: 25, r: 12 },
  { name: "Cable Fly", muscle: "Chest", w: 30, r: 12 },
  { name: "Incline Cable Fly", muscle: "Chest", w: 25, r: 12 },
  { name: "Pec Deck", muscle: "Chest", w: 100, r: 12 },
  { name: "Machine Chest Press", muscle: "Chest", w: 110, r: 10 },
  { name: "Smith Machine Bench", muscle: "Chest", w: 95, r: 10 },
  { name: "Landmine Press", muscle: "Chest", w: 45, r: 10 },
  { name: "Svend Press", muscle: "Chest", w: 25, r: 12 },
  { name: "Push-Up", muscle: "Chest", w: 0, r: 15 },
  { name: "Chest Dip", muscle: "Chest", w: 0, r: 10 },
  { name: "Weighted Dip", muscle: "Chest", w: 25, r: 8 },
  // Back
  { name: "Deadlift", muscle: "Back", w: 225, r: 5 },
  { name: "Rack Pull", muscle: "Back", w: 275, r: 5 },
  { name: "Barbell Row", muscle: "Back", w: 115, r: 8 },
  { name: "Pendlay Row", muscle: "Back", w: 115, r: 6 },
  { name: "Dumbbell Row", muscle: "Back", w: 50, r: 10 },
  { name: "Chest-Supported Row", muscle: "Back", w: 90, r: 10 },
  { name: "Meadows Row", muscle: "Back", w: 45, r: 10 },
  { name: "T-Bar Row", muscle: "Back", w: 90, r: 10 },
  { name: "Seated Cable Row", muscle: "Back", w: 120, r: 10 },
  { name: "Machine Row", muscle: "Back", w: 110, r: 10 },
  { name: "Lat Pulldown", muscle: "Back", w: 120, r: 10 },
  { name: "Close-Grip Pulldown", muscle: "Back", w: 110, r: 10 },
  { name: "Straight-Arm Pulldown", muscle: "Back", w: 45, r: 12 },
  { name: "Pull-Up", muscle: "Back", w: 0, r: 8 },
  { name: "Chin-Up", muscle: "Back", w: 0, r: 8 },
  { name: "Weighted Pull-Up", muscle: "Back", w: 25, r: 5 },
  { name: "Inverted Row", muscle: "Back", w: 0, r: 10 },
  { name: "Barbell Shrug", muscle: "Back", w: 185, r: 12 },
  { name: "Dumbbell Shrug", muscle: "Back", w: 60, r: 12 },
  // Shoulders
  { name: "Overhead Press", muscle: "Shoulders", w: 95, r: 8 },
  { name: "Seated DB Press", muscle: "Shoulders", w: 45, r: 10 },
  { name: "Arnold Press", muscle: "Shoulders", w: 35, r: 10 },
  { name: "Machine Shoulder Press", muscle: "Shoulders", w: 90, r: 10 },
  { name: "Push Press", muscle: "Shoulders", w: 115, r: 6 },
  { name: "Lateral Raise", muscle: "Shoulders", w: 20, r: 12 },
  { name: "Cable Lateral Raise", muscle: "Shoulders", w: 15, r: 12 },
  { name: "Front Raise", muscle: "Shoulders", w: 20, r: 12 },
  { name: "Rear Delt Fly", muscle: "Shoulders", w: 15, r: 15 },
  { name: "Reverse Pec Deck", muscle: "Shoulders", w: 80, r: 12 },
  { name: "Face Pull", muscle: "Shoulders", w: 40, r: 15 },
  { name: "Upright Row", muscle: "Shoulders", w: 65, r: 10 },
  // Biceps
  { name: "Barbell Curl", muscle: "Biceps", w: 65, r: 10 },
  { name: "EZ-Bar Curl", muscle: "Biceps", w: 60, r: 10 },
  { name: "Dumbbell Curl", muscle: "Biceps", w: 25, r: 10 },
  { name: "Hammer Curl", muscle: "Biceps", w: 30, r: 10 },
  { name: "Incline DB Curl", muscle: "Biceps", w: 20, r: 10 },
  { name: "Preacher Curl", muscle: "Biceps", w: 55, r: 10 },
  { name: "Cable Curl", muscle: "Biceps", w: 45, r: 12 },
  { name: "Concentration Curl", muscle: "Biceps", w: 20, r: 12 },
  { name: "Spider Curl", muscle: "Biceps", w: 20, r: 12 },
  { name: "Drag Curl", muscle: "Biceps", w: 45, r: 10 },
  // Triceps
  { name: "Close-Grip Bench", muscle: "Triceps", w: 115, r: 8 },
  { name: "Skull Crusher", muscle: "Triceps", w: 60, r: 10 },
  { name: "JM Press", muscle: "Triceps", w: 75, r: 8 },
  { name: "Tricep Pushdown", muscle: "Triceps", w: 50, r: 12 },
  { name: "Rope Pushdown", muscle: "Triceps", w: 45, r: 12 },
  { name: "Overhead Extension", muscle: "Triceps", w: 55, r: 10 },
  { name: "Cable Overhead Extension", muscle: "Triceps", w: 40, r: 12 },
  { name: "Tricep Dip", muscle: "Triceps", w: 0, r: 10 },
  { name: "Bench Dip", muscle: "Triceps", w: 0, r: 12 },
  { name: "DB Kickback", muscle: "Triceps", w: 15, r: 12 },
  { name: "Diamond Push-Up", muscle: "Triceps", w: 0, r: 12 },
  // Forearms
  { name: "Wrist Curl", muscle: "Forearms", w: 45, r: 15 },
  { name: "Reverse Wrist Curl", muscle: "Forearms", w: 25, r: 15 },
  { name: "Reverse Curl", muscle: "Forearms", w: 45, r: 10 },
  { name: "Plate Pinch", muscle: "Forearms", w: 25, r: 10 },
  // Legs
  { name: "Back Squat", muscle: "Legs", w: 185, r: 5 },
  { name: "Front Squat", muscle: "Legs", w: 135, r: 5 },
  { name: "Goblet Squat", muscle: "Legs", w: 50, r: 10 },
  { name: "Hack Squat", muscle: "Legs", w: 180, r: 10 },
  { name: "Smith Machine Squat", muscle: "Legs", w: 135, r: 8 },
  { name: "Leg Press", muscle: "Legs", w: 270, r: 10 },
  { name: "Bulgarian Split Squat", muscle: "Legs", w: 30, r: 10 },
  { name: "Walking Lunge", muscle: "Legs", w: 40, r: 12 },
  { name: "Reverse Lunge", muscle: "Legs", w: 40, r: 10 },
  { name: "Step-Up", muscle: "Legs", w: 30, r: 10 },
  { name: "Leg Extension", muscle: "Legs", w: 90, r: 12 },
  { name: "Romanian Deadlift", muscle: "Legs", w: 155, r: 8 },
  { name: "Stiff-Leg Deadlift", muscle: "Legs", w: 135, r: 8 },
  { name: "Lying Leg Curl", muscle: "Legs", w: 70, r: 12 },
  { name: "Seated Leg Curl", muscle: "Legs", w: 90, r: 12 },
  { name: "Nordic Curl", muscle: "Legs", w: 0, r: 6 },
  { name: "Good Morning", muscle: "Legs", w: 95, r: 10 },
  { name: "Standing Calf Raise", muscle: "Legs", w: 90, r: 15 },
  { name: "Seated Calf Raise", muscle: "Legs", w: 70, r: 15 },
  // Glutes
  { name: "Hip Thrust", muscle: "Glutes", w: 185, r: 10 },
  { name: "Glute Bridge", muscle: "Glutes", w: 135, r: 12 },
  { name: "Sumo Deadlift", muscle: "Glutes", w: 205, r: 5 },
  { name: "Cable Kickback", muscle: "Glutes", w: 20, r: 12 },
  { name: "Hip Abduction", muscle: "Glutes", w: 110, r: 12 },
  { name: "Hip Adduction", muscle: "Glutes", w: 110, r: 12 },
  { name: "Curtsy Lunge", muscle: "Glutes", w: 25, r: 10 },
  { name: "Frog Pump", muscle: "Glutes", w: 0, r: 20 },
  // Core
  { name: "Hanging Leg Raise", muscle: "Core", w: 0, r: 12 },
  { name: "Hanging Knee Raise", muscle: "Core", w: 0, r: 12 },
  { name: "Toes-to-Bar", muscle: "Core", w: 0, r: 10 },
  { name: "Cable Crunch", muscle: "Core", w: 60, r: 15 },
  { name: "Ab Wheel", muscle: "Core", w: 0, r: 10 },
  { name: "Decline Sit-Up", muscle: "Core", w: 0, r: 15 },
  { name: "Weighted Sit-Up", muscle: "Core", w: 25, r: 12 },
  { name: "Russian Twist", muscle: "Core", w: 25, r: 20 },
  { name: "V-Up", muscle: "Core", w: 0, r: 15 },
  { name: "Bicycle Crunch", muscle: "Core", w: 0, r: 20 },
  { name: "Dead Bug", muscle: "Core", w: 0, r: 12 },
  { name: "Wood Chopper", muscle: "Core", w: 30, r: 12 },
  { name: "Pallof Press", muscle: "Core", w: 35, r: 12 },
  { name: "Landmine Twist", muscle: "Core", w: 25, r: 10 },
  // Full Body
  { name: "Power Clean", muscle: "Full Body", w: 135, r: 3 },
  { name: "Hang Clean", muscle: "Full Body", w: 115, r: 3 },
  { name: "Clean & Jerk", muscle: "Full Body", w: 135, r: 2 },
  { name: "Snatch", muscle: "Full Body", w: 95, r: 2 },
  { name: "Thruster", muscle: "Full Body", w: 95, r: 8 },
  { name: "Kettlebell Swing", muscle: "Full Body", w: 53, r: 15 },
  { name: "Turkish Get-Up", muscle: "Full Body", w: 35, r: 3 },
  { name: "Farmer's Carry", muscle: "Full Body", w: 70, r: 1 },
  { name: "Sled Push", muscle: "Full Body", w: 90, r: 1 },
  { name: "Wall Ball", muscle: "Full Body", w: 20, r: 15 },
  { name: "Med Ball Slam", muscle: "Full Body", w: 20, r: 15 },
  { name: "Burpee", muscle: "Full Body", w: 0, r: 12 },
  { name: "Man Maker", muscle: "Full Body", w: 25, r: 8 },
  // Cardio — logged as intervals of minutes + miles
  { name: "Treadmill Run", muscle: "Cardio", min: 20, mi: 2, inc: 1 },
  { name: "Outdoor Run", muscle: "Cardio", min: 30, mi: 3.1 },
  { name: "Sprints", muscle: "Cardio", min: 15, mi: 1 },
  { name: "Incline Walk", muscle: "Cardio", min: 30, mi: 1.5, inc: 12 },
  { name: "Walking", muscle: "Cardio", min: 30, mi: 1.5, inc: 0 },
  { name: "Hiking", muscle: "Cardio", min: 60, mi: 3 },
  { name: "Ruck", muscle: "Cardio", min: 45, mi: 3 },
  { name: "Stairmaster", muscle: "Cardio", min: 15, mi: 0 },
  { name: "Cycling", muscle: "Cardio", min: 30, mi: 8 },
  { name: "Assault Bike", muscle: "Cardio", min: 10, mi: 0 },
  { name: "Rowing Erg", muscle: "Cardio", min: 15, mi: 1.2 },
  { name: "Ski Erg", muscle: "Cardio", min: 10, mi: 1 },
  { name: "Elliptical", muscle: "Cardio", min: 20, mi: 2, inc: 5 },
  { name: "Swimming", muscle: "Cardio", min: 30, mi: 0.5 },
  { name: "Jump Rope", muscle: "Cardio", min: 10, mi: 0 },
  { name: "HIIT Circuit", muscle: "Cardio", min: 20, mi: 0 },
  { name: "Battle Ropes", muscle: "Cardio", min: 5, mi: 0 },
  { name: "Boxing", muscle: "Cardio", min: 15, mi: 0 }
];

export type FieldKey = "w" | "r" | "min" | "mi" | "inc";

export const FIELD_CFG: Record<
  FieldKey,
  { label: string; step: number; min: number; chips: number[]; chipMode: "bump" | "set" }
> = {
  w: { label: "Pounds", step: 5, min: 0, chips: [-10, 10, 25, 45], chipMode: "bump" },
  r: { label: "Reps", step: 1, min: 1, chips: [5, 8, 10, 12], chipMode: "set" },
  min: { label: "Minutes", step: 1, min: 1, chips: [10, 20, 30, 45], chipMode: "set" },
  mi: { label: "Miles", step: 0.5, min: 0, chips: [1, 3.1, 6.2, 13.1], chipMode: "set" },
  inc: { label: "Incline %", step: 0.5, min: 0, chips: [4, 8, 12, 15], chipMode: "set" }
};

export const fmtClock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
export const fmtWeight = (w: number): string | number => (w === 0 ? "BW" : w);
export const fmtMiles = (v: number, dash?: boolean): string | number =>
  v === 0 ? (dash ? "—" : "0") : Number.isInteger(v) ? v : Number(v.toFixed(1));

/**
 * Maps a library exercise name to a canonical trophy lift. Finishing a workout
 * with a PR on one of these logs into user_lifts and can fire the trophy
 * cascade. bench/squat/deadlift are graded on weight; pullups/pushups on reps.
 */
export const CANONICAL_LIFT: Record<string, LiftExercise> = {
  "Bench Press": "bench",
  "Back Squat": "squat",
  Deadlift: "deadlift",
  "Pull-Up": "pullups",
  "Push-Up": "pushups"
};

/** Whether a canonical lift is graded on reps (bodyweight) rather than weight. */
export const CANONICAL_IS_REPS: Record<LiftExercise, boolean> = {
  bench: false,
  squat: false,
  deadlift: false,
  pullups: true,
  pushups: true
};
