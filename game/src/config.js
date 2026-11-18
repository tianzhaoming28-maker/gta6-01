// config.js — Palmira Heat: every shared tuning constant, palette and table.
// One place for numbers so the rest of the game reads as behaviour, not magic.

export const GAME_NAME = 'PALMIRA HEAT';
export const GAME_TAGLINE = 'One driver. One crew. One last score in the city of Palmira.';

export const VIEW_W = 1280;
export const VIEW_H = 720;

// City geometry: a grid of blocks separated by two-lane roads.
export const PITCH = 420;        // block + road pitch
export const ROAD_W = 104;       // road width
export const BLOCK = PITCH - ROAD_W;
export const COLS = 7;           // blocks across
export const ROWS = 5;           // blocks down
export const CITY_W = COLS * PITCH + ROAD_W;
export const CITY_H = ROWS * PITCH + ROAD_W;
export const SAND_H = 210;       // beach strip south of the avenues
export const WATER_H = 330;      // ocean beyond the sand
export const WORLD_W = CITY_W;
export const WORLD_H = CITY_H + SAND_H + WATER_H;

// Golden-hour palette.
export const PAL = {
  asphalt: '#43404e',
  asphaltEdge: '#353240',
  laneMark: '#f5d67b',
  curb: '#8d8578',
  sidewalk: '#cdb69a',
  sidewalkEdge: '#b39d7f',
  grass: '#7fae5a',
  parkPath: '#d9c08d',
  sand: '#ecd28f',
  sandWet: '#dfc078',
  water: '#2e7f9e',
  waterDeep: '#256b8c',
  foam: '#eaf7f2',
  shadow: 'rgba(46,26,54,0.34)',
  plaza: '#d8b98c',
};

// Building colour families: coral, teal, cream, stucco — flat-shaded blocks.
export const BUILDING_COLORS = [
  '#e2725b', '#e88ca0', '#f2a65a', '#f7d08a', '#fdf0d5',
  '#5ec8c0', '#48a9a1', '#7fb5d5', '#a3c585', '#c97b84',
  '#e9c46a', '#f4f1de', '#81b29a', '#e07a5f', '#b8b8d9',
];
export const ROOF_COLORS = ['#b5543f', '#8a5a44', '#5f7d8c', '#a26769', '#71697a', '#936639'];

// Vehicle catalogue: distinct speed, grip and paint per type.
export const CAR_TYPES = {
  compact: { name: 'Solana Compact', w: 34, h: 17, top: 235, accel: 300, grip: 6.4, colors: ['#d94f3d', '#3d7bd9', '#e8b93e', '#57a773', '#e6e6e6'] },
  sedan:   { name: 'Meridian Sedan', w: 38, h: 18, top: 265, accel: 330, grip: 6.0, colors: ['#31556e', '#6e3131', '#c0c6cc', '#2f4f4f', '#704214'] },
  coupe:   { name: 'Vireo Coupe',    w: 38, h: 17, top: 330, accel: 430, grip: 6.8, colors: ['#f2c230', '#e4572e', '#17bebb', '#7d3cff', '#ff5d8f'] },
  muscle:  { name: 'Bruto Muscle',   w: 40, h: 19, top: 310, accel: 470, grip: 5.2, colors: ['#20242b', '#8c1c13', '#e36414', '#0f4c5c', '#5f0f40'] },
  van:     { name: 'Cargo Van',      w: 44, h: 21, top: 215, accel: 260, grip: 5.4, colors: ['#d8d3c3', '#7a8b99', '#4a6741', '#985277'] },
  taxi:    { name: 'Palmira Cab',    w: 38, h: 18, top: 255, accel: 320, grip: 6.0, colors: ['#f7b731'] },
  police:  { name: 'PPD Interceptor', w: 39, h: 18, top: 305, accel: 420, grip: 6.6, colors: ['#f2f2f2'] },
  truck:   { name: 'Hauler Pickup',  w: 42, h: 20, top: 240, accel: 300, grip: 5.6, colors: ['#96705a', '#546e7a', '#8d6e63', '#37474f'] },
};
export const TRAFFIC_TYPES = ['compact', 'sedan', 'coupe', 'muscle', 'van', 'taxi', 'truck'];

// Wanted tuning: heat points map onto stars; decay when unseen and clean.
export const HEAT_FOR_STAR = [0, 12, 34, 70, 120, 190];
export const CRIME_HEAT = {
  theft: 14, hitCar: 8, hitPolice: 22, hitPed: 26, assault: 12,
  shot: 10, killPed: 34, carDamage: 5, roadblock: 16, mission: 0,
};
export const HEAT_DECAY = 3.2;        // points per second while hidden
export const HEAT_DECAY_SEEN = 0.55;  // points per second while police can see you

export const PLAYER_SPEED = 148;
export const PLAYER_SPRINT = 228;
export const PLAYER_RADIUS = 9;

export const SAVE_KEY = 'palmira-heat-save-v1';
