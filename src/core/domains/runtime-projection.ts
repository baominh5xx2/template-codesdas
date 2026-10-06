import type { DomainReference } from "@/contracts/domains";
import type { DomainDefinition } from "./definition";

export interface DomainAgentProjection {
  systemPrompt: string;
  permittedToolNames: string[];
  reference: DomainReference;
  readiness: { available: boolean; missingRequiredFeatures: string[]; omittedOptionalTools: string[] };
}

export function projectDomainForAgent(domain: DomainDefinition, context: { registeredToolNames: ReadonlySet<string>; deploymentAllowlist: ReadonlySet<string>; readyFeatures: ReadonlySet<string> }): DomainAgentProjection {
  const packTools = new Set((domain.tools ?? []).map(tool => tool.name));
  const permittedToolNames = domain.manifest.toolNames.filter(name => packTools.has(name) && context.registeredToolNames.has(name) && context.deploymentAllowlist.has(name) && context.readyFeatures.has(name));
  const omittedOptionalTools = domain.manifest.toolNames.filter(name => !permittedToolNames.includes(name));
  const missingRequiredFeatures = (domain.requirements ?? []).filter(feature => !context.readyFeatures.has(feature));
  return {
    systemPrompt: domain.systemPrompt,
    permittedToolNames,
    reference: { id: domain.manifest.id, version: domain.manifest.version },
    readiness: { available: missingRequiredFeatures.length === 0, missingRequiredFeatures, omittedOptionalTools },
  };
}
