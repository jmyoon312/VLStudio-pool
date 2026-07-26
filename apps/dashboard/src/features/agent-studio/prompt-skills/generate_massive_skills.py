import json
import os

output_dir = r"C:\ViraLoopMedia\VLStudio\apps\dashboard\src\features\agent-studio\prompt-skills"
os.makedirs(output_dir, exist_ok=True)

skills = {}

# 1. Cinematic
skills["cinematic"] = [
    {"id": f"cine_{i}", "name": f"Cinematic {name}", "category": "Cinematic", 
     "camera": cam, "lighting": light, "style": "8k, photorealistic, shot on 35mm lens, cinematic film grain"}
    for i, (name, cam, light) in enumerate([
        ("Dolly Zoom", "Slow dolly zoom, intense focus", "Golden hour, dramatic rim light"),
        ("Handheld", "Shaky handheld camera, chaotic movement", "Natural lighting, cloudy day"),
        ("Steadicam Follow", "Smooth steadicam tracking from behind", "High contrast lighting"),
        ("Low Angle", "Extreme low angle, looking up", "Moody chiaroscuro, deep shadows"),
        ("Overhead", "Bird's eye view, slow rotation", "Bright daylight, sharp shadows"),
        ("Rack Focus", "Static shot, rack focus from foreground to background", "Soft bokeh, neon backlights"),
        ("Pan and Tilt", "Slow diagonal pan and tilt", "Volumetric fog, god rays"),
        ("Tracking Profile", "Profile tracking shot, matching speed", "Cinematic dusk, street lights"),
        ("Dutch Angle", "Canted dutch angle, disorienting", "Harsh directional lighting"),
        ("Crane Shot", "Sweeping crane shot descending", "Epic sunset lighting"),
        ("Whip Pan", "Fast whip pan, motion blur", "High-key studio lighting"),
        ("Extreme Close Up", "Macro extreme close up, static", "Ring light, macro reflections"),
        ("Wide Establishing", "Ultra wide establishing shot, static", "Magic hour, vibrant colors"),
        ("Push In", "Slow push in on subject's face", "Rembrandt lighting, intimate"),
        ("Pull Out", "Fast pull out revealing environment", "Desaturated cinematic lighting")
    ])
]

# 2. Anime
skills["anime"] = [
    {"id": f"anime_{i}", "name": f"Anime {name}", "category": "Animation", 
     "camera": cam, "lighting": light, "style": style}
    for i, (name, cam, light, style) in enumerate([
        ("Ghibli Nature", "Static wide shot, gentle pan", "Soft pastel sunlight, warm glowing", "Studio Ghibli style, 2D animation, lush backgrounds, watercolor"),
        ("Cyberpunk Akira", "Dynamic action tracking, fast zoom", "Neon pink and blue, high contrast", "90s cyberpunk anime, cel-shaded, highly detailed, retro anime"),
        ("Shinkai Skies", "Slow tilt up to the sky", "Breathtaking volumetric clouds, lens flare", "Makoto Shinkai style, hyper-detailed skies, beautiful 2D animation"),
        ("Ufotable Combat", "Fast spinning camera, motion blur", "Glowing aura, particle effects, dramatic", "Ufotable style, Fate series, 2D/3D hybrid, explosive colors"),
        ("Trigger Action", "Exaggerated perspective, low angle", "Flat vibrant lighting, bold shadows", "Studio Trigger style, energetic, stylized 2D"),
        ("Slice of Life", "Static eye-level shot, slow push in", "Cozy afternoon sunlight, soft shadows", "Kyoto Animation style, slice of life, detailed character art"),
        ("Mecha Launch", "Fast tracking shot, upward pan", "Hangar lights, metallic reflections", "Gundam style, 80s mecha anime, detailed mechanical line art"),
        ("Dark Fantasy", "Slow dolly in, tight framing", "Gloomy, dark ambient, subtle red glow", "Dark fantasy anime, Berserk style, gritty, high contrast 2D"),
        ("Chibi Comedy", "Static medium shot", "Bright, flat comedic lighting", "Chibi anime style, cute, colorful, super deformed"),
        ("Retro 80s", "Slow pan, static", "Neon synthwave lighting, CRT scanlines", "80s anime aesthetic, City Pop vibe, VHS effect, pastel neon")
    ])
]

# 3. Horror
skills["horror"] = [
    {"id": f"horror_{i}", "name": f"Horror {name}", "category": "Horror", 
     "camera": cam, "lighting": light, "style": "Horror cinematic, photorealistic, grainy, terrifying, 4k"}
    for i, (name, cam, light) in enumerate([
        ("Found Footage", "Shaky handheld, POV, erratic movement", "Flashlight beam, pitch black surroundings"),
        ("Creeping Zoom", "Very slow, unnoticeable zoom in", "Dimly lit, flickering fluorescent light"),
        ("Hidden Observer", "Static shot from behind an object, voyeuristic", "Low-key lighting, deep shadows"),
        ("Sudden Pan", "Static then rapid pan to the dark corner", "Moonlight through window, high contrast"),
        ("Dutch Canted", "Severe dutch angle, slow rotation", "Sickly green/yellow color grading, sickly lighting"),
        ("Hallway Tracking", "Slow reverse tracking shot down a hallway", "Pulsing red emergency lights"),
        ("Underbed POV", "Low angle ground level shot", "Almost total darkness, faint ambient light"),
        ("Mirror Reveal", "Tracking shot behind subject passing a mirror", "Harsh bathroom lighting, cold tones"),
        ("Staircase Descent", "High angle looking down stairs, slow push", "Shadows stretching upwards"),
        ("Jumpscare Push", "Extremely fast push in", "Strobe lighting, disorienting")
    ])
]

# 4. SciFi
skills["scifi"] = [
    {"id": f"scifi_{i}", "name": f"Sci-Fi {name}", "category": "Sci-Fi", 
     "camera": cam, "lighting": light, "style": "Sci-fi cinematic, Unreal Engine 5 render, highly detailed, futuristic"}
    for i, (name, cam, light) in enumerate([
        ("Neon Slums", "Slow pan across crowded street", "Cyberpunk neon lights, rain reflections, volumetric fog"),
        ("Space Walk", "Smooth floating camera, zero gravity movement", "Harsh stark sunlight against deep black space"),
        ("Holo Deck", "Orbiting camera around subject", "Holographic blue glow, futuristic sterile lighting"),
        ("Warp Speed", "Static camera, environment zooming past", "Streaking starlight, intense bright center"),
        ("Mecha Hangar", "Low angle, slow tilt up", "Industrial overhead lights, sparks, volumetric beams"),
        ("Dystopian City", "High altitude drone shot, slow push", "Smoggy, desaturated, oppressive gray lighting"),
        ("Alien Planet", "Wide sweeping pan", "Bioluminescent flora lighting, twin suns, surreal colors"),
        ("Cybernetic Eye", "Extreme macro close up", "Red laser glow, metallic reflections"),
        ("Time Portal", "Fast spinning dolly in", "Swirling purple and blue energy lights"),
        ("Lab Containment", "Static medium shot, slight handheld", "Sterile white LED, warning yellow flashes")
    ])
]

# 5. Documentary
skills["docu"] = [
    {"id": f"docu_{i}", "name": f"Documentary {name}", "category": "Documentary", 
     "camera": cam, "lighting": light, "style": "National Geographic style, photorealistic, 8k, sharp focus"}
    for i, (name, cam, light) in enumerate([
        ("Wildlife Macro", "Macro extreme close up, slow rack focus", "Natural dappled sunlight"),
        ("Savanna Drone", "High sweeping drone shot, tracking subject", "Golden hour, harsh savanna sun"),
        ("Deep Ocean", "Slow smooth submersible pan", "Deep blue ambient, strong spotlight beam"),
        ("Historical Archive", "Static slow zoom in (Ken Burns effect)", "Sepia tone, vintage lighting"),
        ("Interview Style", "Static eye-level, shallow depth of field", "Softbox interview lighting, dark background"),
        ("Urban Timelapse", "Static timelapse, fast moving elements", "Day to night transition lighting"),
        ("Jungle Canopy", "Slow tilt down from trees", "God rays cutting through mist, lush green light"),
        ("Arctic Aerial", "Smooth drone pull back", "Blinding white snow reflection, overcast sky"),
        ("Microscopic", "Microscope POV, jittery tracking", "Translucent backlight, vivid staining colors"),
        ("Cultural Festival", "Handheld, immersive tracking", "Vibrant natural light, firelight flickers")
    ])
]

# Write files
for key, data in skills.items():
    filepath = os.path.join(output_dir, f"{key}.json")
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# Write index.js dynamically based on generated files
index_content = "\n".join([f"import {key} from './{key}.json';" for key in skills.keys()])
index_content += "\n\nexport const getAllSkills = () => {\n  return [\n"
index_content += ",\n".join([f"    ...{key}" for key in skills.keys()])
index_content += "\n  ];\n};\n\n"
index_content += """
export const getSkillById = (id) => {
  const allSkills = getAllSkills();
  return allSkills.find(skill => skill.id === id);
};

export const buildVeoPrompt = (skillId, subjectAndAction) => {
  const skill = getSkillById(skillId);
  if (!skill) return `A cinematic shot of ${subjectAndAction}, highly detailed, 8k resolution.`;
  return `${skill.camera} on ${subjectAndAction}, ${skill.lighting}, ${skill.style}`;
};
"""
with open(os.path.join(output_dir, 'index.js'), 'w', encoding='utf-8') as f:
    f.write(index_content)

print("Generated 55+ high quality skills across 5 categories.")
