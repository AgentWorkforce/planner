import type { GuardianConfig } from '../config/forge-config.js';
import { GuardianType, SpeakOnTrigger, DEFAULT_GUARDIAN_TRIGGERS } from '../config/forge-config.js';

// ============================================
// Guardian Prompt Templates
// ============================================

/**
 * Prompt templates for each guardian type.
 * These templates guide the guardian's focus and behavior.
 */
export const GUARDIAN_PROMPT_TEMPLATES: Record<GuardianType, string> = {
  [GuardianType.Security]: `You are a Security Guardian agent.

Your mission is to observe worker agent activity and identify security concerns.

## Focus Areas
- **Credential Exposure**: Watch for hardcoded secrets, API keys, passwords, tokens
- **Injection Risks**: SQL injection, command injection, XSS vulnerabilities
- **Authentication Issues**: Weak auth patterns, session management problems
- **Sensitive Data Exposure**: PII, financial data, health records in logs or outputs
- **Access Control**: Improper authorization checks, privilege escalation paths

## Behavior
- Shadow assigned worker agents and monitor their code changes
- When you detect a security concern:
  1. Assess severity (info, warning, critical)
  2. For critical issues, immediately alert the human operator
  3. For warnings, message the worker with specific guidance
  4. Record all observations for retrospective
- Be specific about what you found and where
- Provide actionable recommendations

## Response Format
When reporting concerns, include:
- Location (file, function, line if known)
- Description of the vulnerability
- Potential impact
- Recommended fix`,

  [GuardianType.Architect]: `You are an Architecture Guardian agent.

Your mission is to observe worker agent activity and maintain architectural integrity.

## Focus Areas
- **Boundary Violations**: Code that crosses module/service boundaries inappropriately
- **Pattern Inconsistencies**: Deviations from established patterns in the codebase
- **Dependency Violations**: Circular dependencies, improper coupling
- **API Contract Changes**: Breaking changes to interfaces, schemas, contracts
- **Layering Violations**: Business logic in presentation layer, etc.

## Behavior
- Shadow assigned worker agents and monitor their code changes
- When you detect an architectural concern:
  1. Assess severity based on scope of impact
  2. For boundary violations, message the worker immediately
  3. Record observations about architectural drift
  4. Suggest refactoring approaches that align with existing patterns
- Reference existing code as examples of correct patterns
- Consider long-term maintainability

## Response Format
When reporting concerns, include:
- Component/module affected
- Type of architectural violation
- Impact on system design
- Example of correct pattern from codebase
- Recommended approach`,

  [GuardianType.QA]: `You are a QA Guardian agent.

Your mission is to observe worker agent activity and ensure quality standards.

## Focus Areas
- **Test Coverage Drops**: New code without adequate tests
- **Quality Regressions**: Code that may introduce bugs or reduce reliability
- **Missing Tests**: Untested edge cases, error paths, boundary conditions
- **Performance Regressions**: Inefficient algorithms, N+1 queries, memory leaks
- **Code Smells**: Long methods, deep nesting, duplicated code

## Behavior
- Shadow assigned worker agents and monitor their code changes
- When you detect a quality concern:
  1. Assess severity based on risk
  2. For coverage drops, request specific test cases
  3. For performance issues, provide specific metrics or benchmarks
  4. Record observations about quality trends
- Be specific about what tests are missing
- Suggest test scenarios that would improve coverage

## Response Format
When reporting concerns, include:
- Component/file affected
- Type of quality issue
- Risk assessment
- Specific test cases that should be added
- Performance impact if applicable`,

  [GuardianType.Compliance]: `You are a Compliance Guardian agent.

Your mission is to observe worker agent activity and ensure regulatory compliance.

## Focus Areas
- **License Violations**: Incompatible licenses, missing attributions
- **Policy Violations**: Deviations from organizational policies
- **Data Retention Issues**: Improper data storage, missing cleanup
- **Audit Trail Gaps**: Missing logging, incomplete audit records
- **Regulatory Requirements**: GDPR, HIPAA, SOX, PCI-DSS violations

## Behavior
- Shadow assigned worker agents and monitor their code changes
- When you detect a compliance concern:
  1. Assess severity based on regulatory impact
  2. For license issues, check compatibility matrices
  3. For data issues, verify retention policies
  4. Alert human operator for potential regulatory violations
- Document all compliance observations
- Provide specific policy references

## Response Format
When reporting concerns, include:
- Regulation or policy affected
- Specific violation type
- Potential legal/financial impact
- Required remediation steps
- Documentation requirements`,
};

// ============================================
// Predefined Guardian Configurations
// ============================================

/**
 * Creates a default Security guardian configuration.
 */
export function createSecurityGuardianConfig(
  shadowTargets: string[] = ['*'],
  enabled: boolean = true
): GuardianConfig {
  return {
    type: GuardianType.Security,
    enabled,
    shadow_targets: shadowTargets,
    speak_on: DEFAULT_GUARDIAN_TRIGGERS[GuardianType.Security] as string[],
    prompt_template: GUARDIAN_PROMPT_TEMPLATES[GuardianType.Security],
    description: 'Security guardian monitoring for vulnerabilities and security risks',
  };
}

/**
 * Creates a default Architect guardian configuration.
 */
export function createArchitectGuardianConfig(
  shadowTargets: string[] = ['*'],
  enabled: boolean = true
): GuardianConfig {
  return {
    type: GuardianType.Architect,
    enabled,
    shadow_targets: shadowTargets,
    speak_on: DEFAULT_GUARDIAN_TRIGGERS[GuardianType.Architect] as string[],
    prompt_template: GUARDIAN_PROMPT_TEMPLATES[GuardianType.Architect],
    description: 'Architecture guardian enforcing design patterns and boundaries',
  };
}

/**
 * Creates a default QA guardian configuration.
 */
export function createQAGuardianConfig(
  shadowTargets: string[] = ['*'],
  enabled: boolean = true
): GuardianConfig {
  return {
    type: GuardianType.QA,
    enabled,
    shadow_targets: shadowTargets,
    speak_on: DEFAULT_GUARDIAN_TRIGGERS[GuardianType.QA] as string[],
    prompt_template: GUARDIAN_PROMPT_TEMPLATES[GuardianType.QA],
    description: 'QA guardian monitoring for test coverage and quality regressions',
  };
}

/**
 * Creates a default Compliance guardian configuration.
 */
export function createComplianceGuardianConfig(
  shadowTargets: string[] = ['*'],
  enabled: boolean = true
): GuardianConfig {
  return {
    type: GuardianType.Compliance,
    enabled,
    shadow_targets: shadowTargets,
    speak_on: DEFAULT_GUARDIAN_TRIGGERS[GuardianType.Compliance] as string[],
    prompt_template: GUARDIAN_PROMPT_TEMPLATES[GuardianType.Compliance],
    description: 'Compliance guardian monitoring for license and policy violations',
  };
}

/**
 * Creates all standard guardian configurations.
 */
export function createStandardGuardianConfigs(
  shadowTargets: string[] = ['*'],
  enabledTypes: GuardianType[] = [
    GuardianType.Security,
    GuardianType.Architect,
    GuardianType.QA,
    GuardianType.Compliance,
  ]
): Record<string, GuardianConfig> {
  const configs: Record<string, GuardianConfig> = {};

  if (enabledTypes.includes(GuardianType.Security)) {
    configs['security-guardian'] = createSecurityGuardianConfig(shadowTargets);
  }
  if (enabledTypes.includes(GuardianType.Architect)) {
    configs['architect-guardian'] = createArchitectGuardianConfig(shadowTargets);
  }
  if (enabledTypes.includes(GuardianType.QA)) {
    configs['qa-guardian'] = createQAGuardianConfig(shadowTargets);
  }
  if (enabledTypes.includes(GuardianType.Compliance)) {
    configs['compliance-guardian'] = createComplianceGuardianConfig(shadowTargets);
  }

  return configs;
}

// ============================================
// Trigger Detection Patterns
// ============================================

/**
 * Patterns for detecting security triggers in code/output.
 */
export const SECURITY_DETECTION_PATTERNS = {
  [SpeakOnTrigger.CredentialExposure]: [
    /(?:api[_-]?key|secret|password|token|credential)s?\s*[:=]\s*['"][^'"]+['"]/gi,
    /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi,
    /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
  ],
  [SpeakOnTrigger.InjectionRisk]: [
    /\$\{.*\}\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/gi,
    /exec\s*\(\s*['"]?\s*(?:\$|req\.|input)/gi,
    /innerHTML\s*=\s*(?:\$|req\.|user)/gi,
  ],
  [SpeakOnTrigger.AuthIssue]: [
    /(?:auth|login|session)\s*=\s*(?:true|false|null)/gi,
    /(?:password|pwd)\s*==\s*['"][^'"]*['"]/gi,
    /bypass[_-]?auth/gi,
  ],
};

/**
 * Patterns for detecting architecture triggers.
 */
export const ARCHITECTURE_DETECTION_PATTERNS = {
  [SpeakOnTrigger.BoundaryViolation]: [
    /import\s+.*from\s+['"]\.\.\/\.\.\/(?!shared|common)/gi,
    /require\s*\(\s*['"]\.\.\/\.\.\/(?!shared|common)/gi,
  ],
  [SpeakOnTrigger.DependencyViolation]: [
    /circular\s+dependency/gi,
    /import\s+.*\/internal\//gi,
  ],
};

/**
 * Patterns for detecting QA triggers.
 */
export const QA_DETECTION_PATTERNS = {
  [SpeakOnTrigger.MissingTests]: [
    /(?:function|class|export\s+(?:default\s+)?(?:function|class))\s+\w+[^}]+\}\s*$/gm,
    /\.skip\s*\(/gi,
    /todo:\s*add\s*test/gi,
  ],
  [SpeakOnTrigger.QualityRegression]: [
    /\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK/gi,
    /console\.(?:log|error|warn)\s*\(/gi,
    /debugger;/gi,
  ],
};

/**
 * Checks if a text matches any patterns for a trigger type.
 */
export function checkTriggerPatterns(
  text: string,
  triggerType: string
): boolean {
  const allPatterns = {
    ...SECURITY_DETECTION_PATTERNS,
    ...ARCHITECTURE_DETECTION_PATTERNS,
    ...QA_DETECTION_PATTERNS,
  };

  const patterns = allPatterns[triggerType as keyof typeof allPatterns];
  if (!patterns) {
    return false;
  }

  return patterns.some(pattern => pattern.test(text));
}

/**
 * Finds all trigger matches in a text.
 */
export function findTriggerMatches(
  text: string,
  triggerType: string
): Array<{ match: string; index: number }> {
  const allPatterns = {
    ...SECURITY_DETECTION_PATTERNS,
    ...ARCHITECTURE_DETECTION_PATTERNS,
    ...QA_DETECTION_PATTERNS,
  };

  const patterns = allPatterns[triggerType as keyof typeof allPatterns];
  if (!patterns) {
    return [];
  }

  const matches: Array<{ match: string; index: number }> = [];

  for (const pattern of patterns) {
    // Reset regex state
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        match: match[0],
        index: match.index,
      });
    }
  }

  return matches;
}
