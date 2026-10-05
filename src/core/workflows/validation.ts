import type { WorkflowDefinition } from "./definition";
export function assertPriorDependencies(ids: string[], index: number, dependsOn: string[]): void {
  if (new Set(dependsOn).size !== dependsOn.length) throw new Error("workflow_dependency_duplicate");
  for (const dependency of dependsOn) {
    const dependencyIndex = ids.indexOf(dependency);
    if (dependencyIndex < 0 || dependencyIndex >= index) throw new Error("workflow_dependency_invalid");
  }
}
export function validateWorkflow(definition: WorkflowDefinition): void {
  const ids = definition.steps.map(step => step.id);
  if (new Set(ids).size !== ids.length) throw new Error("workflow_step_duplicate");
  definition.steps.forEach((step, index) => {
    if (!step.id || !step.artifactKind || !Number.isInteger(step.version) || step.version < 1 || step.timeoutMs <= 0 || step.retry < 0) throw new Error("workflow_step_invalid");
    assertPriorDependencies(ids, index, step.dependsOn);
  });
  const available = new Set(definition.steps.map(step => step.artifactKind));
  if (definition.requiredArtifactKinds.some(kind => !available.has(kind))) throw new Error("workflow_required_artifact_missing");
}
