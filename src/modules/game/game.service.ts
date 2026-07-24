import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

type GamePhase = 'ORIGIN' | 'RESONANCE' | 'ASCENSION';
type CardRarity = 'WHITE' | 'BLUE' | 'ORANGE' | 'PURPLE';

interface DrawCardOptions {
  characterId?: number;
  forceLucky?: boolean;
}

interface CharacterRow {
  character_id: string;
  name: string;
  level: number;
  exp: number;
  phase: string;
}

interface CardRow {
  card_id: string;
  name: string;
  rarity: string;
  description?: string | null;
}

interface StatEffectRow {
  stats_name: string;
  value: number;
}

interface StatRow {
  stats_id: string;
  stats_name: string;
}

const LEVEL_CUMULATIVE_EXP = [
  80, 185, 325, 510, 750, 1060, 1460, 1970, 2620, 3440, 4470, 5750, 7350, 9300,
  11700, 14600, 18100, 22300, 27300,
];

const PHASE_POOL: Record<
  GamePhase,
  {
    normal: Array<{ rarity: CardRarity; weight: number }>;
    lucky: Array<{ rarity: CardRarity; weight: number }>;
  }
> = {
  ORIGIN: {
    normal: [
      { rarity: 'WHITE', weight: 85 },
      { rarity: 'BLUE', weight: 15 },
    ],
    lucky: [
      { rarity: 'WHITE', weight: 60 },
      { rarity: 'BLUE', weight: 40 },
    ],
  },
  RESONANCE: {
    normal: [
      { rarity: 'BLUE', weight: 80 },
      { rarity: 'ORANGE', weight: 20 },
    ],
    lucky: [
      { rarity: 'BLUE', weight: 55 },
      { rarity: 'ORANGE', weight: 45 },
    ],
  },
  ASCENSION: {
    normal: [
      { rarity: 'ORANGE', weight: 80 },
      { rarity: 'PURPLE', weight: 20 },
    ],
    lucky: [
      { rarity: 'ORANGE', weight: 55 },
      { rarity: 'PURPLE', weight: 45 },
    ],
  },
};

const LUCKY_EFFECT_MULTIPLIER: Record<CardRarity, number> = {
  WHITE: 1.5,
  BLUE: 1.4,
  ORANGE: 1.3,
  PURPLE: 1.2,
};

const RARITY_LABEL: Record<CardRarity, string> = {
  WHITE: 'Normal',
  BLUE: 'Rare',
  ORANGE: 'Epic',
  PURPLE: 'Legendary',
};

const PHASE_LABEL: Record<GamePhase, string> = {
  ORIGIN: 'Origin Chasentia',
  RESONANCE: 'Resonance Chasentia',
  ASCENSION: 'Ascension Chasentia',
};

@Injectable()
export class GameService implements OnModuleDestroy {
  private dataSource?: DataSource;

  async onModuleDestroy() {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
    }
  }

  private getGameSchema() {
    const schema = process.env.GAME_DB_SCHEMA || 'game';
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
      throw new Error('Invalid GAME_DB_SCHEMA');
    }
    return schema;
  }

  private quoteIdentifier(identifier: string) {
    return '"' + identifier.replace(/"/g, '""') + '"';
  }

  private async getDataSource() {
    if (this.dataSource?.isInitialized) {
      return this.dataSource;
    }

    this.dataSource = new DataSource({
      type: 'postgres',
      host: process.env.GAME_DB_HOST || process.env.DB_HOST,
      port: Number(process.env.GAME_DB_PORT || process.env.DB_PORT),
      username: process.env.GAME_DB_USER || process.env.DB_USER,
      password: process.env.GAME_DB_PASSWORD || process.env.DB_PASSWORD,
      database: process.env.GAME_DB_NAME || process.env.DB_NAME,
      synchronize: false,
      logging: false,
    });

    await this.dataSource.initialize();
    return this.dataSource;
  }

  private normalizePhase(phase?: string): GamePhase {
    const normalized = String(phase || '').toUpperCase();
    if (normalized.includes('ASCENSION') || normalized === 'PHASE_3') {
      return 'ASCENSION';
    }
    if (normalized.includes('RESONANCE') || normalized === 'PHASE_2') {
      return 'RESONANCE';
    }
    return 'ORIGIN';
  }

  private normalizeRarity(rarity?: string): CardRarity {
    const normalized = String(rarity || '').toUpperCase();
    if (normalized.includes('PURPLE') || normalized.includes('LEGENDARY')) {
      return 'PURPLE';
    }
    if (normalized.includes('ORANGE') || normalized.includes('EPIC')) {
      return 'ORANGE';
    }
    if (normalized.includes('BLUE') || normalized.includes('RARE')) {
      return 'BLUE';
    }
    return 'WHITE';
  }

  private pickWeightedRarity(
    pool: Array<{ rarity: CardRarity; weight: number }>,
  ): CardRarity {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    const roll = Math.random() * total;
    let cursor = 0;

    for (const item of pool) {
      cursor += item.weight;
      if (roll <= cursor) {
        return item.rarity;
      }
    }

    return pool[pool.length - 1].rarity;
  }

  private resolveLevel(exp: number, currentLevel: number) {
    let level = 1;
    for (let i = 0; i < LEVEL_CUMULATIVE_EXP.length; i += 1) {
      if (exp >= LEVEL_CUMULATIVE_EXP[i]) {
        level = i + 2;
      }
    }
    return Math.max(level, currentLevel);
  }

  private resolvePhase(
    currentPhase: GamePhase,
    level: number,
    averageStats: number,
  ): GamePhase {
    const phaseOrder: GamePhase[] = ['ORIGIN', 'RESONANCE', 'ASCENSION'];
    let nextPhase: GamePhase = 'ORIGIN';

    if (level >= 20 && averageStats >= 150) {
      nextPhase = 'ASCENSION';
    } else if (level >= 10 && averageStats >= 50) {
      nextPhase = 'RESONANCE';
    }

    return phaseOrder.indexOf(nextPhase) > phaseOrder.indexOf(currentPhase)
      ? nextPhase
      : currentPhase;
  }

  private formatCardName(cardName: string, isLucky: boolean) {
    if (!isLucky) return cardName;

    if (cardName.startsWith('《') && cardName.endsWith('》')) {
      return `${cardName.slice(0, -1)}·强化》`;
    }

    return `${cardName}·强化`;
  }

  private calculateExp(effects: StatEffectRow[]) {
    const total = ['Spark', 'Vitality', 'Fortune', 'Harmony'].reduce(
      (sum, statName) =>
        sum +
        (effects.find(
          (effect) =>
            effect.stats_name.toLowerCase() === statName.toLowerCase(),
        )?.value ?? 0),
      0,
    );
    return Math.round(total / 4);
  }

  private async getOrCreateCharacter(
    queryRunner: QueryRunner,
    characterId?: number,
  ): Promise<CharacterRow> {
    if (characterId) {
      const rows = await queryRunner.query(
        `SELECT character_id::text, name, level, exp, phase
         FROM "character"
         WHERE character_id = $1
         FOR UPDATE`,
        [characterId],
      );
      if (rows.length) return rows[0];
      throw new Error(`character_id=${characterId} does not exist`);
    }

    const rows = await queryRunner.query(
      `SELECT character_id::text, name, level, exp, phase
       FROM "character"
       ORDER BY character_id
       LIMIT 1
       FOR UPDATE`,
    );
    if (rows.length) return rows[0];

    const inserted = await queryRunner.query(
      `INSERT INTO "character"(name, level, exp, phase)
       VALUES ('Chasentia', 1, 0, 'ORIGIN')
       RETURNING character_id::text, name, level, exp, phase`,
    );
    return inserted[0];
  }

  private async pickCard(
    queryRunner: QueryRunner,
    rarity: CardRarity,
    fallbackRarities: CardRarity[],
  ): Promise<CardRow> {
    const cardRows = await queryRunner.query(
      `SELECT card_id::text, name, rarity, description
       FROM card
       WHERE UPPER(rarity) = $1
       ORDER BY random()
       LIMIT 1`,
      [rarity],
    );
    if (cardRows.length) return cardRows[0];

    const fallbackRows = await queryRunner.query(
      `SELECT card_id::text, name, rarity, description
       FROM card
       WHERE UPPER(rarity) = ANY($1)
       ORDER BY random()
       LIMIT 1`,
      [fallbackRarities],
    );
    if (fallbackRows.length) return fallbackRows[0];

    throw new Error('No card found in current phase pool');
  }

  private async getStatsMap(queryRunner: QueryRunner) {
    const rows: StatRow[] = await queryRunner.query(
      `SELECT stats_id::text, stats_name FROM stats`,
    );
    return new Map(
      rows.map((row) => [row.stats_name.toLowerCase(), Number(row.stats_id)]),
    );
  }

  private async getCharacterStats(
    queryRunner: QueryRunner,
    characterId: number,
  ) {
    const rows = await queryRunner.query(
      `SELECT s.stats_name, COALESCE(rcs.value, 0)::int AS value
       FROM stats s
       LEFT JOIN r_character_stats rcs
         ON rcs.stats_id = s.stats_id AND rcs.character_id = $1`,
      [characterId],
    );

    const result: Record<string, number> = {
      Spark: 0,
      Vitality: 0,
      Fortune: 0,
      Harmony: 0,
    };

    for (const row of rows) {
      const key = Object.keys(result).find(
        (name) => name.toLowerCase() === String(row.stats_name).toLowerCase(),
      );
      if (key) {
        result[key] = Number(row.value);
      }
    }

    return result;
  }

  private buildDrawMessage(params: {
    character: CharacterRow;
    card: CardRow;
    rarity: CardRarity;
    isLucky: boolean;
    isMiracle: boolean;
    effects: StatEffectRow[];
    gainedExp: number;
    beforeLevel: number;
    afterLevel: number;
    beforePhase: GamePhase;
    afterPhase: GamePhase;
    totalExp: number;
    stats: Record<string, number>;
  }) {
    const effectLines = params.effects
      .filter((effect) => effect.value !== 0)
      .map((effect) => `${effect.stats_name} +${effect.value}`)
      .join('\n');

    const levelLine =
      params.afterLevel > params.beforeLevel
        ? `Level ${params.beforeLevel} → ${params.afterLevel}`
        : `Level ${params.afterLevel}`;

    const phaseLine =
      params.afterPhase !== params.beforePhase
        ? `Phase Shift: ${PHASE_LABEL[params.beforePhase]} → ${PHASE_LABEL[params.afterPhase]}`
        : PHASE_LABEL[params.afterPhase];

    return (
      `${params.isLucky ? '🌟 Lucky Resonance' : '✨ Chasentia Resonance'}\n\n` +
      `${params.isLucky ? '获得强化：' : '获得：'}\n` +
      `${this.formatCardName(params.card.name, params.isLucky)}\n\n` +
      `${RARITY_LABEL[params.rarity]}\n\n` +
      `${effectLines || '四维属性保持稳定'}\n\n` +
      `EXP +${params.gainedExp}\n` +
      `${params.isMiracle ? 'Miracle：直接额外提升 1 级\n' : ''}` +
      `${levelLine}\n` +
      `${phaseLine}\n\n` +
      `当前状态：${params.character.name} Lv${params.afterLevel} / EXP ${params.totalExp}\n` +
      `Spark ${params.stats.Spark} | Vitality ${params.stats.Vitality} | Fortune ${params.stats.Fortune} | Harmony ${params.stats.Harmony}`
    );
  }

  async drawCard(options: DrawCardOptions = {}) {
    const dataSource = await this.getDataSource();
    const queryRunner = dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    await queryRunner.query(
      'SET LOCAL search_path TO ' + this.quoteIdentifier(this.getGameSchema()),
    );

    try {
      const character = await this.getOrCreateCharacter(
        queryRunner,
        options.characterId,
      );
      const characterId = Number(character.character_id);
      const beforePhase = this.normalizePhase(character.phase);
      const beforeLevel = Number(character.level);
      const beforeExp = Number(character.exp);
      const isLucky = options.forceLucky ?? Math.random() < 0.2;
      const phasePool = PHASE_POOL[beforePhase][isLucky ? 'lucky' : 'normal'];
      const rarity = this.pickWeightedRarity(phasePool);
      const card = await this.pickCard(
        queryRunner,
        rarity,
        phasePool.map((item) => item.rarity),
      );
      const actualRarity = this.normalizeRarity(card.rarity);

      const baseEffects: StatEffectRow[] = await queryRunner.query(
        `SELECT s.stats_name, rcs.value::int AS value
         FROM r_card_stats rcs
         INNER JOIN stats s ON s.stats_id = rcs.stats_id
         WHERE rcs.card_id = $1`,
        [Number(card.card_id)],
      );

      const multiplier = isLucky ? LUCKY_EFFECT_MULTIPLIER[actualRarity] : 1;
      const effects = baseEffects.map((effect) => ({
        stats_name: effect.stats_name,
        value: Math.round(Number(effect.value) * multiplier),
      }));
      const gainedExp = this.calculateExp(effects);
      const statsMap = await this.getStatsMap(queryRunner);

      for (const effect of effects) {
        const statsId = statsMap.get(effect.stats_name.toLowerCase());
        if (!statsId) continue;

        await queryRunner.query(
          `INSERT INTO r_character_stats(character_id, stats_id, value)
           VALUES ($1, $2, $3)
           ON CONFLICT(character_id, stats_id)
           DO UPDATE SET value = r_character_stats.value + EXCLUDED.value`,
          [characterId, statsId, effect.value],
        );
      }

      await queryRunner.query(
        `INSERT INTO r_card_character(character_id, card_id, is_lucky)
         VALUES ($1, $2, $3)`,
        [characterId, Number(card.card_id), isLucky],
      );

      const totalExp = beforeExp + gainedExp;
      const isMiracle = isLucky && Math.random() < 0.03;
      const levelFromExp = this.resolveLevel(totalExp, beforeLevel);
      const afterLevel = levelFromExp + (isMiracle ? 1 : 0);
      const stats = await this.getCharacterStats(queryRunner, characterId);
      const averageStats = Math.round(
        (stats.Spark + stats.Vitality + stats.Fortune + stats.Harmony) / 4,
      );
      const afterPhase = this.resolvePhase(
        beforePhase,
        afterLevel,
        averageStats,
      );

      await queryRunner.query(
        `UPDATE "character"
         SET level = $1, exp = $2, phase = $3, updated_time = CURRENT_TIMESTAMP
         WHERE character_id = $4`,
        [afterLevel, totalExp, afterPhase, characterId],
      );

      await queryRunner.commitTransaction();

      const content = this.buildDrawMessage({
        character,
        card,
        rarity: actualRarity,
        isLucky,
        isMiracle,
        effects,
        gainedExp,
        beforeLevel,
        afterLevel,
        beforePhase,
        afterPhase,
        totalExp,
        stats,
      });

      return {
        content,
        character: {
          characterId,
          name: character.name,
          level: afterLevel,
          exp: totalExp,
          phase: afterPhase,
          stats,
        },
        draw: {
          cardId: Number(card.card_id),
          cardName: card.name,
          rarity: actualRarity,
          isLucky,
          isMiracle,
          effects,
          gainedExp,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
