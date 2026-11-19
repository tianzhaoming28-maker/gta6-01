// Coral Vice - global configuration and shared constants.
// Every other script reads its tuning from the CV namespace so the
// whole game can be rebalanced from this one file.
'use strict';

var CV = window.CV || {};
window.CV = CV;

// ---- Canvas / view -------------------------------------------------------
CV.VIEW_W = 1280;
CV.VIEW_H = 720;
CV.TICK = 1 / 60; // fixed simulation step, seconds

// ---- City layout ---------------------------------------------------------
// The city is a grid: square blocks of buildings separated by two-lane
// roads. Roads run along the lines x = i * PITCH and y = j * PITCH.
CV.BLOCK = 132;          // building block size in px
CV.ROAD = 46;            // road width in px
CV.PITCH = CV.BLOCK + CV.ROAD; // 178
CV.COLS = 9;             // blocks across
CV.ROWS = 9;             // blocks down
CV.WORLD_W = CV.COLS * CV.PITCH + CV.ROAD;
CV.WORLD_H = CV.ROWS * CV.PITCH + CV.ROAD;
CV.SIDEWALK = 7;         // sidewalk border drawn around each block

// ---- Player --------------------------------------------------------------
CV.PLAYER_RADIUS = 9;
CV.PLAYER_SPEED = 118;   // px/s on foot
CV.PLAYER_SPRINT = 178;
CV.PLAYER_MAX_HP = 100;

// ---- Vehicles ------------------------------------------------------------
CV.CAR_W = 34;           // sprite length
CV.CAR_H = 17;           // sprite width
CV.CAR_MAX_HP = 100;

// ---- Wanted system -------------------------------------------------------
CV.WANTED_DECAY = 0.55;  // crime points per second when unseen
CV.CRIME_PUNCH = 6;
CV.CRIME_SHOOT = 10;
CV.CRIME_KILL = 26;
CV.CRIME_CARJACK = 14;
CV.CRIME_HIT_CAR = 5;
CV.CRIME_HIT_PED = 30;
CV.STAR_POINTS = 22;     // crime points per star

// ---- Palette ---------------------------------------------------------------
CV.COLORS = {
  grass: '#3f7d4e',
  grassDark: '#37703f',
  sidewalk: '#b9b3a4',
  road: '#33373d',
  roadLine: '#e8d44d',
  curb: '#8f8a7c',
  water: '#2e6f9e',
  sand: '#e3d29b'
};

// Building paint jobs, pastel art-deco colours for the Coral Bay look.
CV.BUILDING_COLORS = [
  '#e8a2b4', '#f2c14e', '#7fc8bc', '#f4f1de', '#e07a5f',
  '#81b29a', '#f2cc8f', '#c9ada7', '#9bb7d4', '#e6b8a2',
  '#a3d9b1', '#f0e68c', '#dda0dd', '#87ceeb', '#ffb07c'
];

CV.CAR_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad',
  '#ecf0f1', '#2c3e50', '#e67e22', '#1abc9c', '#fd79a8',
  '#95a5a6', '#dfe6e9', '#6c5ce7', '#00b894'
];

CV.PED_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6',
  '#e67e22', '#1abc9c', '#fd79a8', '#ffffff', '#34495e'
];

// First names used for flavour text when a pedestrian is involved in news.
CV.PED_NAMES = [
  'Marisol', 'Dario', 'Paloma', 'Esteban', 'Lucia', 'Rafael',
  'Camila', 'Hugo', 'Valentina', 'Oscar', 'Ines', 'Mateo'
];

// Save-game key in localStorage.
CV.SAVE_KEY = 'coral-vice-save-v1';
