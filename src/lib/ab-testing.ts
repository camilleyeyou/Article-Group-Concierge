/**
 * A/B Testing Framework for Orchestrator Prompts
 *
 * Allows testing different prompt variations to optimize:
 * - Response quality
 * - Component selection
 * - Layout structure
 * - Explanation clarity
 *
 * Usage:
 * 1. Define prompt variants
 * 2. Framework automatically assigns users to variants
 * 3. Track metrics (user satisfaction, component usage, etc.)
 * 4. Analyze results to determine winning variant
 */

import { analytics } from './analytics';
import { logger } from './logger';

interface PromptVariant {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  weight: number; // 0-100, for weighted distribution
  enabled: boolean;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  variants: PromptVariant[];
  startDate: Date;
  endDate?: Date;
  active: boolean;
}

interface ExperimentAssignment {
  experimentId: string;
  variantId: string;
  assignedAt: number;
}

interface ExperimentMetrics {
  experimentId: string;
  variantId: string;
  totalAssignments: number;
  successRate: number;
  avgResponseTime: number;
  avgComponentCount: number;
  userFeedback: {
    positive: number;
    negative: number;
  };
}

class ABTestingFramework {
  private experiments: Map<string, Experiment>;
  private assignments: Map<string, ExperimentAssignment>; // userId -> assignment
  private metrics: Map<string, ExperimentMetrics[]>; // experimentId -> metrics

  constructor() {
    this.experiments = new Map();
    this.assignments = new Map();
    this.metrics = new Map();
  }

  /**
   * Create a new experiment
   */
  createExperiment(experiment: Omit<Experiment, 'startDate'>): void {
    const exp: Experiment = {
      ...experiment,
      startDate: new Date(),
    };

    this.experiments.set(exp.id, exp);
    logger.info('A/B experiment created', { id: exp.id, name: exp.name });
  }

  /**
   * Get variant for a user (consistent assignment)
   */
  getVariant(experimentId: string, userId: string): PromptVariant | null {
    const experiment = this.experiments.get(experimentId);

    if (!experiment || !experiment.active) {
      return null;
    }

    // Check if user already has an assignment
    const existingAssignment = this.assignments.get(`${experimentId}:${userId}`);
    if (existingAssignment) {
      const variant = experiment.variants.find(v => v.id === existingAssignment.variantId);
      if (variant) {
        return variant;
      }
    }

    // Assign new variant based on weights
    const variant = this.assignVariant(experiment, userId);
    if (variant) {
      this.assignments.set(`${experimentId}:${userId}`, {
        experimentId,
        variantId: variant.id,
        assignedAt: Date.now(),
      });

      logger.debug('User assigned to variant', {
        experimentId,
        userId,
        variantId: variant.id,
      });
    }

    return variant;
  }

  /**
   * Assign variant based on weights
   */
  private assignVariant(experiment: Experiment, userId: string): PromptVariant | null {
    const enabledVariants = experiment.variants.filter(v => v.enabled);

    if (enabledVariants.length === 0) {
      return null;
    }

    // Calculate total weight
    const totalWeight = enabledVariants.reduce((sum, v) => sum + v.weight, 0);

    // Generate deterministic random number from userId
    const hash = this.hashString(userId + experiment.id);
    const random = (hash % 10000) / 10000; // 0-1

    // Select variant based on weighted distribution
    let cumulativeWeight = 0;
    for (const variant of enabledVariants) {
      cumulativeWeight += variant.weight / totalWeight;
      if (random <= cumulativeWeight) {
        return variant;
      }
    }

    // Fallback to first variant
    return enabledVariants[0];
  }

  /**
   * Simple string hash for deterministic randomization
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Track experiment outcome
   */
  trackOutcome(
    experimentId: string,
    variantId: string,
    metrics: {
      success: boolean;
      responseTime: number;
      componentCount: number;
      userFeedback?: 'positive' | 'negative';
    }
  ): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      return;
    }

    // Get or create metrics for this experiment
    let expMetrics = this.metrics.get(experimentId);
    if (!expMetrics) {
      expMetrics = experiment.variants.map(v => ({
        experimentId,
        variantId: v.id,
        totalAssignments: 0,
        successRate: 0,
        avgResponseTime: 0,
        avgComponentCount: 0,
        userFeedback: { positive: 0, negative: 0 },
      }));
      this.metrics.set(experimentId, expMetrics);
    }

    // Update metrics for the variant
    const variantMetrics = expMetrics.find(m => m.variantId === variantId);
    if (variantMetrics) {
      variantMetrics.totalAssignments++;

      // Update running averages
      const n = variantMetrics.totalAssignments;
      variantMetrics.avgResponseTime =
        (variantMetrics.avgResponseTime * (n - 1) + metrics.responseTime) / n;
      variantMetrics.avgComponentCount =
        (variantMetrics.avgComponentCount * (n - 1) + metrics.componentCount) / n;
      variantMetrics.successRate =
        (variantMetrics.successRate * (n - 1) + (metrics.success ? 1 : 0)) / n;

      if (metrics.userFeedback === 'positive') {
        variantMetrics.userFeedback.positive++;
      } else if (metrics.userFeedback === 'negative') {
        variantMetrics.userFeedback.negative++;
      }
    }

    // Track in analytics
    analytics.trackPerformance(`ab_test_${experimentId}`, metrics.responseTime, {
      variantId,
      success: metrics.success,
      componentCount: metrics.componentCount,
    });

    logger.debug('A/B test outcome tracked', {
      experimentId,
      variantId,
      success: metrics.success,
    });
  }

  /**
   * Get experiment results
   */
  getResults(experimentId: string): ExperimentMetrics[] | null {
    return this.metrics.get(experimentId) || null;
  }

  /**
   * Get experiment summary
   */
  getSummary(experimentId: string): {
    experiment: Experiment;
    metrics: ExperimentMetrics[];
    winner?: string;
  } | null {
    const experiment = this.experiments.get(experimentId);
    const metrics = this.metrics.get(experimentId);

    if (!experiment || !metrics) {
      return null;
    }

    // Determine winner based on success rate and user feedback
    let bestVariant: ExperimentMetrics | undefined;
    let bestScore = -1;

    for (const m of metrics) {
      if (m.totalAssignments < 10) {
        continue; // Skip variants with insufficient data
      }

      // Composite score: success rate + user feedback ratio
      const feedbackTotal = m.userFeedback.positive + m.userFeedback.negative;
      const feedbackScore =
        feedbackTotal > 0 ? m.userFeedback.positive / feedbackTotal : 0.5;

      const score = m.successRate * 0.7 + feedbackScore * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestVariant = m;
      }
    }

    return {
      experiment,
      metrics,
      winner: bestVariant?.variantId,
    };
  }

  /**
   * Stop an experiment
   */
  stopExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (experiment) {
      experiment.active = false;
      experiment.endDate = new Date();
      logger.info('A/B experiment stopped', { id: experimentId });
    }
  }

  /**
   * List all experiments
   */
  listExperiments(): Experiment[] {
    return Array.from(this.experiments.values());
  }
}

// Export singleton instance
export const abTesting = new ABTestingFramework();

// Example experiment setup
export function setupDefaultExperiments(): void {
  // Example: Test different system prompt variations
  abTesting.createExperiment({
    id: 'orchestrator-prompt-v1',
    name: 'Orchestrator Prompt Optimization',
    description: 'Testing different approaches to prompt engineering',
    active: false, // Set to true to activate
    variants: [
      {
        id: 'control',
        name: 'Control (Current)',
        description: 'Current production prompt',
        systemPrompt: '', // Load from orchestrator.ts
        weight: 50,
        enabled: true,
      },
      {
        id: 'variant-a',
        name: 'More Structured',
        description: 'Emphasizes step-by-step reasoning',
        systemPrompt: '', // Alternative prompt
        weight: 50,
        enabled: true,
      },
    ],
  });
}
