# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**vinyl-os** is a repository containing the BMAD Method (version 6.0) - a comprehensive AI-driven agile development framework. This is NOT a traditional software project with build commands, but rather a methodology system with agents, workflows, and configuration files that work within AI IDEs (Claude Code, Cursor, VS Code with Copilot).

## Key Configuration

- **Project Name**: vinyl-os
- **User**: Thiago
- **Language**: Portuguese (communication) / Portuguese BR (documentation)
- **Documentation Output**: `{project-root}/docs`
- **Dev Stories**: `{project-root}/docs/stories`

## Architecture

BMAD Method consists of four core modules organized as a modular framework:

### Module Structure

```
bmad/
├── core/          # Foundation framework
│   ├── agents/    # bmad-master (orchestrator)
│   ├── tasks/     # Core workflow engine (workflow.xml, validate-workflow.xml)
│   ├── tools/     # Utilities (shard-doc, index-docs)
│   └── workflows/ # Basic workflows (brainstorming, party-mode)
├── bmm/           # BMad Method Module - Core development lifecycle
│   ├── agents/    # PM, Analyst, Architect, SM, DEV, TEA, UX
│   ├── workflows/ # 4-phase methodology (Analysis → Planning → Solutioning → Implementation)
│   ├── tasks/     # Atomic workflow components
│   ├── teams/     # Multi-agent coordination
│   └── testarch/  # Testing strategy workflows
├── bmb/           # BMad Builder - Module/agent/workflow creation tools
│   ├── agents/    # bmad-builder (creation orchestrator)
│   └── workflows/ # create-agent, create-workflow, create-module, edit-*, audit-*, redoc
├── cis/           # Creative Intelligence Suite - Facilitated creativity
│   ├── agents/    # Carson, Maya, Dr. Quinn, Victor, Sophia (facilitator personas)
│   └── workflows/ # brainstorming, design-thinking, problem-solving, innovation-strategy, storytelling
└── _cfg/          # Shared configuration templates
```

### Parallel Systems (IDE-Specific)

1. **Claude Code Slash Commands**: `.claude/commands/bmad/` (59 commands)
   - Structured as: `/bmad:{module}:{type}:{name}`
   - Example: `/bmad:bmm:agents:pm`, `/bmad:bmm:workflows:prd`

2. **Cursor Rules**: `.cursor/rules/bmad/` (MDC format)
   - Referenced as: `@bmad/{module}/{type}/{name}`
   - Example: `@bmad/bmm/agents/pm`, `@bmad/bmm/workflows/prd`

## How Slash Commands Work

BMAD agents are activated through slash commands:

```bash
/bmad:bmm:agents:pm              # Activate Product Manager
/bmad:bmm:workflows:prd          # Run PRD workflow
/bmad:bmm:agents:dev             # Activate Developer
/bmad:cis:agents:storyteller     # Activate Sophia (storyteller)
/bmad:bmb:workflows:create-agent # Create new agent
```

Each agent slash command:
1. Loads persona and configuration from the agent file
2. Reads `bmad/{module}/config.yaml` for session variables
3. Displays interactive menu of available workflows/commands
4. Executes workflows via the core workflow engine (`bmad/core/tasks/workflow.xml`)

## Workflow Engine

The core workflow system is defined in `bmad/core/tasks/workflow.xml`. All workflows:

1. Are defined in YAML files (`workflow.yaml`)
2. Reference config files via `config_source` property
3. Use variable interpolation: `{config_source:field}`, `{project-root}`, `{date}`
4. Execute through structured XML instructions loaded by agents
5. Support templates (`template-output`), elicitation (`elicit`), and validation

## BMM Development Lifecycle (Primary Workflow)

BMM provides scale-adaptive development (Level 0-4) across four phases:

### Entry Points
- **workflow-status**: Check current phase and progress
- **workflow-init**: Initialize new project tracking

### Phase Flow
```
PREREQUISITE: document-project (brownfield without docs)
                    ↓
PHASE 1: Analysis (optional)
    brainstorm-project → research → product-brief
                    ↓
PHASE 2: Planning (required, scale-adaptive)
    Level 0-1: tech-spec only
    Level 2-4: prd (PRD + epics)
                    ↓
PHASE 3: Solutioning (Level 2-4 only)
    architecture → solutioning-gate-check
                    ↓
PHASE 4: Implementation (iterative)
    sprint-planning → create-story → story-context → dev-story → code-review
```

### Story Lifecycle
```
BACKLOG → TODO → IN PROGRESS → DONE
```
Tracked in `bmm-workflow-status.md` (single source of truth)

### Key Agents
- **PM**: Product planning, PRD creation, requirement management
- **Analyst**: Research, product briefs, business analysis
- **Architect**: Technical architecture, system design
- **SM**: Sprint/story management, backlog coordination
- **DEV**: Story implementation, coding
- **TEA**: Test strategy, quality assurance
- **UX**: User experience design

## CIS Creative Workflows

Facilitator-driven creativity sessions (not code generation):

- **Agents**: Carson (brainstorm), Maya (design thinking), Dr. Quinn (problem solving), Victor (innovation), Sophia (storytelling)
- **150+ techniques** across 5 specialized workflows
- Focus: Question-driven facilitation, not solution generation
- Energy-aware session management

## BMB Builder Module

Tools for extending BMAD:

- **create-agent**: Build new agent personas
- **create-workflow**: Design multi-step workflows
- **create-module**: Package complete module solutions
- **edit-agent/workflow/module**: Modify existing components
- **audit-workflow**: Validate workflow structure
- **redoc**: Auto-generate documentation

## File Locations

- **Agents**: `bmad/{module}/agents/*.md` (source) + `.claude/commands/bmad/{module}/agents/*.md` (slash commands)
- **Workflows**: `bmad/{module}/workflows/{workflow-name}/workflow.yaml`
- **Config**: `bmad/{module}/config.yaml`
- **Core Engine**: `bmad/core/tasks/*.xml`
- **Documentation**: `bmad/docs/`, `bmad/{module}/README.md`
- **Stories**: `docs/stories/` (BMM dev stories)

## Important Patterns

### Agent Activation Pattern
1. Load persona from agent .md file
2. Read module config.yaml and store session variables
3. Display greeting with user's name from config
4. Show numbered menu of workflows/commands
5. Wait for user selection (number or fuzzy text match)
6. Execute via menu handlers (workflow, validate-workflow, etc.)

### Config Variable Resolution
- `{config_source:field}`: Value from module config.yaml
- `{project-root}`: Repository root path
- `{installed_path}`: BMAD installation path
- `{date}`: System-generated timestamp
- `{user_name}`, `{communication_language}`: From config.yaml

### Workflow Execution Rules
- ALL files read completely (no offset/limit)
- Steps execute in numerical order
- Template outputs saved after EACH step
- User approval required between major sections (unless #yolo mode)
- Never delegate steps - execute directly

## EventBus Memory Safety

The Vinyl-OS backend uses an EventBus (pub/sub pattern) for internal component communication. **Critical memory leak prevention is required when using EventBus.**

### The Problem

EventBus handlers create JavaScript closures that capture the component's context (`this`). If a component is destroyed but forgets to unsubscribe, the handler keeps the **entire component in memory forever**, including all its data (buffers, config, etc). In a 24/7 always-on system like Vinyl-OS, this causes memory leaks that grow unbounded.

### Required Pattern

**Every component using EventBus MUST:**

1. **Store handler as class property** (not anonymous function)
2. **Implement destroy() method**
3. **Call unsubscribe() in destroy()**
4. **Call destroy() when component is no longer needed**

### Correct Usage

```typescript
class MyService {
  private handler: EventHandler;

  constructor() {
    // ✅ Store handler reference
    this.handler = async (payload) => {
      this.processEvent(payload);
    };
    
    eventBus.subscribe('event.name', this.handler);
  }

  async destroy() {
    // ✅ Unsubscribe in cleanup
    eventBus.unsubscribe('event.name', this.handler);
  }
}
```

### Wrong Usage (Memory Leak)

```typescript
class MyService {
  constructor() {
    // ❌ Anonymous function - can't unsubscribe later!
    eventBus.subscribe('event.name', async (payload) => {
      this.processEvent(payload);
    });
  }
  // ❌ No destroy method = memory leak!
}
```

### SubscriptionManager Utility

For easier cleanup, use `createSubscriptionManager()` from `backend/src/utils/lifecycle.ts`:

```typescript
import { createSubscriptionManager, Destroyable } from './utils/lifecycle';

class MyService implements Destroyable {
  private subscriptions = createSubscriptionManager();

  constructor() {
    // ✅ Automatically tracked for cleanup
    this.subscriptions.subscribe('audio.start', async (p) => { ... });
    this.subscriptions.subscribe('audio.stop', async (p) => { ... });
  }

  async destroy() {
    // ✅ Single call cleans up ALL subscriptions
    this.subscriptions.cleanup();
  }
}
```

### When Cleanup is NOT Needed

Long-lived singleton services that live for the entire app lifetime (e.g., `audio-manager.ts`) do NOT need to unsubscribe, as they're never destroyed. Always document this decision in the class comment.

### Code Review Checklist

When reviewing code that uses EventBus:
- [ ] Are handlers stored as class properties?
- [ ] Does the class have a destroy() method?
- [ ] Does destroy() call unsubscribe() or subscriptions.cleanup()?
- [ ] If no cleanup: Is it documented as a long-lived singleton?
- [ ] Are there tests for cleanup behavior?

For more details, see:
- `backend/src/utils/event-bus.ts` (comprehensive JSDoc)
- `backend/src/utils/lifecycle.ts` (utilities)
- `.cursor/rules/eventbus-safety.mdc` (reference via @eventbus-safety)

## Navigation Tips

- Start with module READMEs: `bmad/{module}/README.md`
- Workflow guides: `bmad/{module}/workflows/README.md`
- Index of all components: `.cursor/rules/bmad/index.mdc`
- Claude Code instructions: `bmad/docs/claude-code-instructions.md`
- Cursor instructions: `bmad/docs/cursor-instructions.md`

## Language Note

While this CLAUDE.md is in English for broader accessibility, all user-facing interactions should be in **Portuguese** per the configuration. Document outputs should be in **Portuguese BR**.
