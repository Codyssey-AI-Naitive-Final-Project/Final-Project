export type FitnessKnowledgeSource = {
  title: string;
  publisher: string;
  url: string;
};

export type FitnessKnowledgeChunk = FitnessKnowledgeSource & {
  id: string;
  content: string;
  keywords: string[];
};

const knowledgeChunks: FitnessKnowledgeChunk[] = [
  {
    id: "exercise-energy",
    title: "Sporting performance and food",
    publisher: "Better Health Channel, State Government of Victoria",
    url: "https://www.betterhealth.vic.gov.au/health/healthyliving/sporting-performance-and-food",
    content: "운동에는 훈련량에 맞는 충분한 에너지와 영양이 필요하다. 탄수화물은 운동의 주요 에너지원이며, 통곡물·과일 등 평소 식사에서 에너지와 탄수화물을 보충할 수 있다. 필요한 양은 운동의 시간, 빈도, 강도에 따라 달라지므로 이 자료만으로 개인별 섭취량을 정하지 않는다.",
    keywords: ["에너지", "탄수화물", "연료", "글리코겐", "운동 전", "운동후", "운동 후", "러닝 전", "러닝 후", "간식", "energy", "carbohydrate", "fuel"],
  },
  {
    id: "exercise-recovery",
    title: "Sporting performance and food",
    publisher: "Better Health Channel, State Government of Victoria",
    url: "https://www.betterhealth.vic.gov.au/health/healthyliving/sporting-performance-and-food",
    content: "운동 후 회복에는 탄수화물을 포함한 식사와 충분한 수분이 도움이 될 수 있다. 특히 짧은 시간 안에 다음 운동이 예정되어 있다면 회복 식사와 수분 보충을 고려한다. 식사 시점과 구성은 운동과 개인의 소화 편안함에 맞춰 조정한다.",
    keywords: ["회복", "운동 후", "식사", "탄수화물", "다음 운동", "수분 보충", "recovery", "post-workout"],
  },
  {
    id: "protein-recovery",
    title: "Sporting performance and food",
    publisher: "Better Health Channel, State Government of Victoria",
    url: "https://www.betterhealth.vic.gov.au/health/healthyliving/sporting-performance-and-food",
    content: "단백질은 운동 적응과 운동 후 회복 및 조직 수리에 관여한다. 일반적으로 다양한 식품을 포함한 균형 잡힌 식사로 단백질을 섭취할 수 있으며, 단백질 보충제가 모든 사람에게 필요한 것은 아니다. 개인별 필요량이나 보충제 용량은 이 자료만으로 판단하지 않는다.",
    keywords: ["단백질", "근육", "회복", "보충제", "운동 후", "protein", "muscle"],
  },
  {
    id: "hydration",
    title: "Water: How much should you drink every day?",
    publisher: "Mayo Clinic",
    url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/water/art-20044256",
    content: "운동으로 땀을 흘리면 운동 전·중·후 수분 보충을 고려한다. 필요한 양은 활동량, 땀, 기온과 개인 건강 상태에 따라 달라질 수 있으므로 모두에게 같은 양을 권하지 않는다. 지나치게 많은 물을 억지로 마시는 것도 안전하지 않을 수 있다.",
    keywords: ["수분", "물", "갈증", "탈수", "땀", "더위", "운동 중", "수분 섭취", "hydration", "water", "dehydration"],
  },
];

export function searchFitnessKnowledge(query: string, limit = 4) {
  const normalizedQuery = query.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const matches = knowledgeChunks
    .map((chunk) => ({
      chunk,
      score: chunk.keywords.reduce((score, keyword) => score + (normalizedQuery.includes(keyword.toLocaleLowerCase()) ? 1 : 0), 0),
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ chunk }) => chunk);

  const sources = [...new Map(matches.map(({ title, publisher, url }) => [url, { title, publisher, url }])).values()];
  return { chunks: matches, sources };
}