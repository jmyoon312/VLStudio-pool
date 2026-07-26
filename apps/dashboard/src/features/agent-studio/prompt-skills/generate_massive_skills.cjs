const fs = require('fs');
const path = require('path');

const outputDir = __dirname;
const skills = {};

skills["cinematic"] = [
  ["Dolly Zoom", "Slow dolly zoom, intense focus", "Golden hour, dramatic rim light"],
  ["Handheld", "Shaky handheld camera, chaotic movement", "Natural lighting, cloudy day"],
  ["Steadicam Follow", "Smooth steadicam tracking from behind", "High contrast lighting"],
  ["Low Angle", "Extreme low angle, looking up", "Moody chiaroscuro, deep shadows"],
  ["Overhead", "Bird's eye view, slow rotation", "Bright daylight, sharp shadows"],
  ["Rack Focus", "Static shot, rack focus from foreground to background", "Soft bokeh, neon backlights"],
  ["Pan and Tilt", "Slow diagonal pan and tilt", "Volumetric fog, god rays"],
  ["Tracking Profile", "Profile tracking shot, matching speed", "Cinematic dusk, street lights"],
  ["Dutch Angle", "Canted dutch angle, disorienting", "Harsh directional lighting"],
  ["Crane Shot", "Sweeping crane shot descending", "Epic sunset lighting"]
].map((item, i) => ({
  id: `cine_${i}`, name: `Cinematic ${item[0]}`, category: "Cinematic",
  camera: item[1], lighting: item[2], style: "8k, photorealistic, shot on 35mm lens, cinematic film grain"
}));

skills["anime"] = [
  ["Ghibli Nature", "Static wide shot, gentle pan", "Soft pastel sunlight", "Studio Ghibli style, 2D animation"],
  ["Cyberpunk Akira", "Dynamic action tracking", "Neon pink and blue", "90s cyberpunk anime, cel-shaded"],
  ["Shinkai Skies", "Slow tilt up to the sky", "Breathtaking volumetric clouds", "Makoto Shinkai style, hyper-detailed"],
  ["Ufotable Combat", "Fast spinning camera", "Glowing aura, particle effects", "Ufotable style, Fate series"],
  ["Trigger Action", "Exaggerated perspective", "Flat vibrant lighting", "Studio Trigger style, energetic"],
  ["Slice of Life", "Static eye-level shot", "Cozy afternoon sunlight", "Kyoto Animation style, slice of life"],
  ["Mecha Launch", "Fast tracking shot", "Hangar lights, metallic reflections", "Gundam style, 80s mecha anime"],
  ["Dark Fantasy", "Slow dolly in", "Gloomy, dark ambient", "Dark fantasy anime, Berserk style"],
  ["Chibi Comedy", "Static medium shot", "Bright, flat comedic lighting", "Chibi anime style, cute"],
  ["Retro 80s", "Slow pan, static", "Neon synthwave lighting", "80s anime aesthetic, City Pop vibe"]
].map((item, i) => ({
  id: `anime_${i}`, name: `Anime ${item[0]}`, category: "Animation",
  camera: item[1], lighting: item[2], style: item[3]
}));

skills["horror"] = [
  ["Found Footage", "Shaky handheld, POV", "Flashlight beam, pitch black"],
  ["Creeping Zoom", "Very slow zoom in", "Dimly lit, flickering light"],
  ["Hidden Observer", "Static shot from behind an object", "Low-key lighting, deep shadows"],
  ["Sudden Pan", "Static then rapid pan", "Moonlight through window"],
  ["Dutch Canted", "Severe dutch angle", "Sickly green/yellow color grading"],
  ["Hallway Tracking", "Slow reverse tracking shot", "Pulsing red emergency lights"],
  ["Underbed POV", "Low angle ground level shot", "Almost total darkness"],
  ["Mirror Reveal", "Tracking shot behind subject", "Harsh bathroom lighting"],
  ["Staircase Descent", "High angle looking down stairs", "Shadows stretching upwards"],
  ["Jumpscare Push", "Extremely fast push in", "Strobe lighting, disorienting"]
].map((item, i) => ({
  id: `horror_${i}`, name: `Horror ${item[0]}`, category: "Horror",
  camera: item[1], lighting: item[2], style: "Horror cinematic, photorealistic, grainy, terrifying, 4k"
}));

skills["scifi"] = [
  ["Neon Slums", "Slow pan across street", "Cyberpunk neon lights, rain reflections"],
  ["Space Walk", "Smooth floating camera", "Harsh stark sunlight against deep black space"],
  ["Holo Deck", "Orbiting camera around subject", "Holographic blue glow"],
  ["Warp Speed", "Static camera, environment zooming", "Streaking starlight"],
  ["Mecha Hangar", "Low angle, slow tilt up", "Industrial overhead lights, sparks"],
  ["Dystopian City", "High altitude drone shot", "Smoggy, desaturated lighting"],
  ["Alien Planet", "Wide sweeping pan", "Bioluminescent flora lighting"],
  ["Cybernetic Eye", "Extreme macro close up", "Red laser glow, metallic reflections"],
  ["Time Portal", "Fast spinning dolly in", "Swirling purple and blue energy lights"],
  ["Lab Containment", "Static medium shot", "Sterile white LED, warning yellow flashes"]
].map((item, i) => ({
  id: `scifi_${i}`, name: `Sci-Fi ${item[0]}`, category: "Sci-Fi",
  camera: item[1], lighting: item[2], style: "Sci-fi cinematic, Unreal Engine 5 render, futuristic"
}));

for (const [key, data] of Object.entries(skills)) {
  fs.writeFileSync(path.join(outputDir, `${key}.json`), JSON.stringify(data, null, 2));
}

let indexContent = Object.keys(skills).map(key => `import ${key} from './${key}.json';`).join('\n') + '\n\n';
indexContent += `export const getAllSkills = () => {
  return [
${Object.keys(skills).map(key => `    ...${key}`).join(',\n')}
  ];
};

export const getSkillById = (id) => {
  const allSkills = getAllSkills();
  return allSkills.find(skill => skill.id === id);
};

export const buildVeoPrompt = (skillId, subjectAndAction) => {
  const skill = getSkillById(skillId);
  if (!skill) return \`A cinematic shot of \${subjectAndAction}, highly detailed, 8k resolution.\`;
  return \`\${skill.camera} on \${subjectAndAction}, \${skill.lighting}, \${skill.style}\`;
};
`;

fs.writeFileSync(path.join(outputDir, 'index.js'), indexContent);
console.log("Done");
