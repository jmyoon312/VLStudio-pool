import cinematic from './cinematic.json';
import anime from './anime.json';
import horror from './horror.json';
import scifi from './scifi.json';

export const getAllSkills = () => {
  return [
    ...cinematic,
    ...anime,
    ...horror,
    ...scifi
  ];
};

export const getSkillById = (id) => {
  const allSkills = getAllSkills();
  return allSkills.find(skill => skill.id === id);
};

export const buildVeoPrompt = (skillId, subjectAndAction) => {
  const skill = getSkillById(skillId);
  if (!skill) return `A cinematic shot of ${subjectAndAction}, highly detailed, 8k resolution.`;
  return `${skill.camera} on ${subjectAndAction}, ${skill.lighting}, ${skill.style}`;
};
