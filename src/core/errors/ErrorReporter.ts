import { BaseError } from './BaseError';
import { Logger } from '../../utils/logger';

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByStatusCode: Record<number, number>;
  errorsByCategory: Record<string, number>;
  recentErrors: ErrorReport[];
}

export interface ErrorReport {
  id: string;
  timestamp: string;
  error: {
    name: string;
    code: string;
    message: string;
    statusCode: number;
    stack?: string;
  };
  context: Record<string, unknown>;
  severity: string;
  category: 'user' | 'system' | 'external';
  retryable: boolean;
}

export interface ErrorReporterConfig {
  maxRecentErrors?: number;
  enableMetrics?: boolean;
  enableStackTrace?: boolean;
  excludeStackTraceForCodes?: string[];
}

export class ErrorReporter {
  private readonly logger: Logger;
  private readonly config: ErrorReporterConfig;
  private metrics: ErrorMetrics;

  constructor(logger: Logger, config: ErrorReporterConfig = {}) {
    this.logger = logger;
    this.config = {
      maxRecentErrors: 100,
      enableMetrics: true,
      enableStackTrace: true,
      excludeStackTraceForCodes: ['VALIDATION_ERROR', 'RATE_LIMIT_ERROR'],
      ...config,
    };

    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsByStatusCode: {},
      errorsByCategory: {},
      recentErrors: [],
    };
  }

  reportError(
    error: BaseError,
    context: Record<string, unknown>,
    severity: string,
    category: 'user' | 'system' | 'external',
    retryable: boolean
  ): string {
    const reportId = this.generateReportId();

    const report: ErrorReport = {
      id: reportId,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        stack: this.shouldIncludeStack(error) ? error.stack : undefined,
      },
      context,
      severity,
      category,
      retryable,
    };

    // Update metrics
    if (this.config.enableMetrics) {
      this.updateMetrics(report);
    }

    // Store recent error
    this.addToRecentErrors(report);

    // Log the report
    this.logReport(report);

    return reportId;
  }

  private generateReportId(): string {
    // Use crypto.randomUUID() for guaranteed uniqueness (Node.js 14.17+)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `err_${Date.now()}_${crypto.randomUUID()}`;
    }
    // Fallback to improved random string generation
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private shouldIncludeStack(error: BaseError): boolean {
    if (!this.config.enableStackTrace) {
      return false;
    }

    return !this.config.excludeStackTraceForCodes?.includes(error.code);
  }

  private updateMetrics(report: ErrorReport): void {
    // Update total count
    this.metrics.totalErrors++;

    // Update by type
    const errorType = report.error.name;
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;

    // Update by status code
    const statusCode = report.error.statusCode;
    this.metrics.errorsByStatusCode[statusCode] =
      (this.metrics.errorsByStatusCode[statusCode] || 0) + 1;

    // Update by category
    this.metrics.errorsByCategory[report.category] =
      (this.metrics.errorsByCategory[report.category] || 0) + 1;
  }

  private addToRecentErrors(report: ErrorReport): void {
    this.metrics.recentErrors.unshift(report);

    // Keep only the most recent errors
    if (this.metrics.recentErrors.length > (this.config.maxRecentErrors || 100)) {
      this.metrics.recentErrors = this.metrics.recentErrors.slice(0, this.config.maxRecentErrors);
    }
  }

  private logReport(report: ErrorReport): void {
    const logLevel = this.getLogLevel(report.severity);

    this.logger[logLevel](`Error Report Generated: ${report.id}`, {
      reportId: report.id,
      errorCode: report.error.code,
      errorMessage: report.error.message,
      statusCode: report.error.statusCode,
      category: report.category,
      severity: report.severity,
      retryable: report.retryable,
      context: report.context,
      timestamp: report.timestamp,
    });
  }

  private getLogLevel(severity: string): 'error' | 'warn' | 'info' | 'debug' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'debug';
    }
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  getRecentErrors(limit?: number): ErrorReport[] {
    const actualLimit = limit || this.config.maxRecentErrors || 100;
    return this.metrics.recentErrors.slice(0, actualLimit);
  }

  getErrorsByCategory(category: 'user' | 'system' | 'external'): ErrorReport[] {
    return this.metrics.recentErrors.filter((error) => error.category === category);
  }

  getErrorsByType(errorType: string): ErrorReport[] {
    return this.metrics.recentErrors.filter((error) => error.error.name === errorType);
  }

  getErrorReport(reportId: string): ErrorReport | null {
    return this.metrics.recentErrors.find((error) => error.id === reportId) || null;
  }

  clearMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsByStatusCode: {},
      errorsByCategory: {},
      recentErrors: [],
    };
  }

  generateSummaryReport(): {
    summary: {
      totalErrors: number;
      errorRate: {
        last1Hour: number;
        last24Hours: number;
      };
      topErrorTypes: Array<{ type: string; count: number }>;
      criticalErrors: number;
    };
    recommendations: string[];
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const last1Hour = this.metrics.recentErrors.filter(
      (error) => new Date(error.timestamp) >= oneHourAgo
    ).length;

    const last24Hours = this.metrics.recentErrors.filter(
      (error) => new Date(error.timestamp) >= twentyFourHoursAgo
    ).length;

    const topErrorTypes = Object.entries(this.metrics.errorsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    const criticalErrors = this.metrics.recentErrors.filter(
      (error) => error.severity === 'critical'
    ).length;

    const recommendations = this.generateRecommendations();

    return {
      summary: {
        totalErrors: this.metrics.totalErrors,
        errorRate: {
          last1Hour,
          last24Hours,
        },
        topErrorTypes,
        criticalErrors,
      },
      recommendations,
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Check for high error rate
    const recentErrors = this.metrics.recentErrors.filter(
      (error) => new Date(error.timestamp) >= new Date(Date.now() - 60 * 60 * 1000)
    );

    if (recentErrors.length > 10) {
      recommendations.push(
        'High error rate detected in the last hour. Consider investigating system health.'
      );
    }

    // Check for critical errors
    const criticalErrors = this.metrics.recentErrors.filter(
      (error) => error.severity === 'critical'
    );
    if (criticalErrors.length > 0) {
      recommendations.push(
        `${criticalErrors.length} critical errors detected. Immediate attention required.`
      );
    }

    // Check for external service issues
    const externalErrors = this.metrics.recentErrors.filter(
      (error) => error.category === 'external'
    );
    if (externalErrors.length > 5) {
      recommendations.push(
        'High number of external service errors. Check third-party service status.'
      );
    }

    // Check for validation errors
    const validationErrors = this.metrics.errorsByType['ValidationError'] || 0;
    if (validationErrors > 20) {
      recommendations.push(
        'High number of validation errors. Consider reviewing input validation and user documentation.'
      );
    }

    return recommendations;
  }
}
