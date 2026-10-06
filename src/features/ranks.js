// src/features/ranks.js

const RANKS = [
  { name: 'Rookie', badge: '🌱', minXP: 0, maxXP: 399 },
  { name: 'Explorer', badge: '🔵', minXP: 400, maxXP: 799 },
  { name: 'Solver', badge: '🟣', minXP: 800, maxXP: 1199 },
  { name: 'Challenger', badge: '🟠', minXP: 1200, maxXP: 1599 },
  { name: 'Competitor', badge: '🔴', minXP: 1600, maxXP: 1999 },
  { name: 'Master', badge: '👑', minXP: 2000, maxXP: 2200 }
];

function getRank(xp) {
  const puntos = Math.max(0, Number(xp) || 0);
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (puntos >= RANKS[i].minXP) {
      return RANKS[i];
    }
  }
  return RANKS[0];
}

function getNextRank(currentRankName) {
  const index = RANKS.findIndex(r => r.name.toLowerCase() === currentRankName.toLowerCase());
  if (index === -1 || index === RANKS.length - 1) return null;
  return RANKS[index + 1];
}

function getRankProgress(xp) {
  const puntos = Math.max(0, Number(xp) || 0);
  const currentRank = getRank(puntos);
  const nextRank = getNextRank(currentRank.name);

  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      percentage: 100,
      remainingXP: 0
    };
  }

  const span = nextRank.minXP - currentRank.minXP;
  const gained = puntos - currentRank.minXP;
  const rawPct = Math.floor((gained / span) * 100);
  const percentage = Math.max(0, Math.min(100, rawPct));
  const remainingXP = Math.max(0, nextRank.minXP - puntos);

  return {
    currentRank,
    nextRank,
    percentage,
    remainingXP
  };
}

function generateProgressBar(percentage, length = 10) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filledBlocks = Math.round((clamped / 100) * length);
  const emptyBlocks = length - filledBlocks;
  return `${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}  ${clamped}%`;
}

function assignRankPositions(studentsList) {
  const sorted = [...studentsList].sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
  let currentRankNum = 1;

  return sorted.map((student, index) => {
    if (index > 0 && student.puntos < sorted[index - 1].puntos) {
      currentRankNum = index + 1;
    }
    return {
      ...student,
      position: currentRankNum
    };
  });
}

function groupStudentsByRank(studentsWithPoints) {
  const grouped = {
    Master: [],
    Competitor: [],
    Challenger: [],
    Solver: [],
    Explorer: [],
    Rookie: []
  };

  studentsWithPoints.forEach(student => {
    const rank = getRank(student.puntos);
    if (grouped[rank.name]) {
      grouped[rank.name].push(student);
    }
  });

  const result = {};
  for (const [rankName, list] of Object.entries(grouped)) {
    result[rankName] = assignRankPositions(list);
  }

  return result;
}

function checkLevelUp(oldXP, newXP) {
  const previousRank = getRank(oldXP);
  const nextRank = getRank(newXP);

  const prevIndex = RANKS.findIndex(r => r.name === previousRank.name);
  const nextIndex = RANKS.findIndex(r => r.name === nextRank.name);

  if (nextIndex > prevIndex) {
    return nextRank;
  }
  return null;
}

function getEarnedBadges({ practicas, totalPracticas, integradores, totalIntegradores, mocks, totalMocks }) {
  const badges = [];

  if (totalPracticas > 0 && practicas >= totalPracticas) {
    badges.push({ name: 'Task Master', badge: '📝', desc: 'Completó todas las prácticas' });
  }
  if (totalIntegradores > 0 && integradores >= totalIntegradores) {
    badges.push({ name: 'Contestant', badge: '🏆', desc: 'Participó en todos los integradores' });
  }
  if (totalMocks > 0 && mocks >= totalMocks) {
    badges.push({ name: 'Interview Ready', badge: '🎤', desc: 'Completó todas las Mock Interviews' });
  }

  return badges;
}

module.exports = {
  RANKS,
  getRank,
  getNextRank,
  getRankProgress,
  generateProgressBar,
  assignRankPositions,
  groupStudentsByRank,
  checkLevelUp,
  getEarnedBadges
};

