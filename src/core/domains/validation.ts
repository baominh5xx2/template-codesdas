import type { DomainDefinition, DomainValidationCatalog } from "./definition";
import { validateWorkflow } from "@/core/workflows/validation";

export function validateDomain(domain: DomainDefinition, catalog: DomainValidationCatalog): void {
  if (!domain.manifest.id || domain.manifest.version < 1) throw new Error("domain_invalid");
  const identity = `${domain.manifest.id}@${domain.manifest.version}`;
  if (catalog.registeredDomainIdentities.has(identity)) throw new Error("domain_identity_duplicate");
  const workflow = domain.workflow;
  if (workflow) {
    validateWorkflow(workflow);
    if (workflow.steps.some(step => !catalog.artifactSchemas.has(step.artifactKind, step.version))) throw new Error("domain_artifact_schema_unregistered");
  }
  if (domain.sources.some(id => !catalog.sourceProfileIds.has(id))) throw new Error("domain_source_unregistered");
  const bindings = domain.resultBindings ?? [];
  const bindingIds = new Set<string>();
  const boundTools = new Set<string>();
  for (const binding of bindings) {
    const toolKey = `${binding.toolName}@${binding.toolVersion}`;
    if (!isSemver(binding.toolVersion)) throw new Error("domain_tool_version_invalid");
    if (bindingIds.has(binding.id) || boundTools.has(toolKey)) throw new Error("domain_result_binding_duplicate");
    bindingIds.add(binding.id);
    boundTools.add(toolKey);
    if (!catalog.artifactSchemas.has(binding.artifactKind, binding.artifactVersion)) throw new Error("domain_artifact_schema_unregistered");
  }
  const tools = domain.tools ?? [];
  const hasVersionedReferences = tools.length > 0 || bindings.length > 0;
  const isToolRegistered = (name: string, version: string): boolean => {
    if (catalog.registeredTools) {
      const registered = catalog.registeredTools.get(`${name}@${version}`);
      return registered?.name === name && registered.version === version;
    }
    return !hasVersionedReferences && catalog.toolNames.has(name);
  };
  for (const tool of tools) {
    if (!isSemver(tool.version)) throw new Error("domain_tool_version_invalid");
    if (!isToolRegistered(tool.name, tool.version)) throw new Error("domain_tool_unregistered");
  }
  for (const binding of bindings) {
    if (!isToolRegistered(binding.toolName, binding.toolVersion)) throw new Error("domain_tool_unregistered");
  }
  if (domain.tools && (domain.manifest.toolNames.length !== new Set(domain.manifest.toolNames).size ||
    domain.manifest.toolNames.length !== tools.length || tools.some(tool => !domain.manifest.toolNames.includes(tool.name)) ||
    bindings.some(binding => !tools.some(tool => tool.name === binding.toolName && tool.version === binding.toolVersion)))) {
    throw new Error("domain_tool_unregistered");
  }
  if (domain.manifest.toolNames.some(name => !catalog.toolNames.has(name) && !tools.some(tool => tool.name === name))) throw new Error("domain_tool_unregistered");
  const workflowProducers = new Set(workflow?.steps.map(step => step.artifactKind) ?? []);
  const bindingProducers = new Set(bindings.map(binding => binding.artifactKind));
  if (domain.requiredArtifactKinds.some(kind => !workflowProducers.has(kind) && !bindingProducers.has(kind))) throw new Error("domain_artifact_unproduced");
  catalog.registeredDomainIdentities.add(identity);
}
const isSemver = (version: string) => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);
export type { DomainValidationCatalog };
