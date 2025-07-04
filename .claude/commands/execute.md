---
allowed-tools: [Read, Grep, Bash, mcp__github__create_branch, TodoWrite, Edit, Write, MultiEdit, Glob, Task, exit_plan_mode, mcp__taskmaster-ai__get_tasks, mcp__taskmaster-ai__next_task, mcp__taskmaster-ai__get_task, mcp__taskmaster-ai__add_task, mcp__taskmaster-ai__update_task, mcp__taskmaster-ai__update_subtask, mcp__taskmaster-ai__set_task_status, mcp__taskmaster-ai__expand_task, mcp__taskmaster-ai__analyze_project_complexity]
description: Execute SINGLE tasks using TaskMaster AI with mandatory planning, user approval, and no auto-progression
---

# CRITICAL: SINGLE TASK EXECUTION ONLY

This command implements **EXACTLY ONE** task or subtask at a time and **NEVER** automatically progresses to the next task. After completion, it STOPS and waits for user instruction.

## Context
- Task management: TaskMaster AI MCP server
- Project root: /Users/asafatzmon/dev/marketing-post-generator-mcp
- Current tasks: Use mcp__taskmaster-ai__get_tasks to view existing tasks
- Next task: Use mcp__taskmaster-ai__next_task to find recommended work
- Current codebase state: check git status and recent commits

## Your task

### Phase 1: Planning Mode (MANDATORY - NEVER SKIP)
1. **Analyze Request**: Analyze the user's request thoroughly
2. **Check TaskMaster Context**: Use mcp__taskmaster-ai__get_tasks to check existing tasks
3. **Find Relevant Task**: Use mcp__taskmaster-ai__next_task or mcp__taskmaster-ai__get_task to identify the specific task
4. **Create Execution Plan**: Create a comprehensive plan that includes:
   - **Single Task Focus**: Clearly identify the ONE task being implemented
   - **Task Analysis**: Break down ONLY this specific request into core components
   - **TaskMaster Integration**: Map request to the specific TaskMaster task (no others)
   - **Current State Assessment**: Review existing code and implementation progress for THIS task only
   - **Implementation Strategy**: Outline approach and methodology for THIS task only
   - **Step-by-Step Plan**: Detailed steps with clear deliverables for THIS task only
   - **Branch Strategy**: Recommend feature branch naming for THIS task
   - **Risk Assessment**: Identify potential challenges for THIS task only
   - **Testing Strategy**: Define testing approach for THIS task only
   - **Success Criteria**: Define how success will be measured for THIS task only
   - **TaskMaster Updates**: Plan for updating ONLY this task's status
   - **Execution Boundary**: Clearly state where execution stops (no auto-progression)
5. **Present Plan**: Use exit_plan_mode to present the plan to the user for approval

### Phase 2: Plan Approval (MANDATORY - WAIT FOR USER APPROVAL)
1. **Present Plan**: Present the comprehensive plan to the user
2. **STOP AND WAIT**: Do NOT proceed to implementation until user explicitly approves
3. **Wait for User Response**:
   - If user approves → proceed to Phase 3
   - If user requests modifications → proceed to Phase 4 (Iteration)
   - If user rejects → end execution

### Phase 3: Implementation (ONLY AFTER EXPLICIT USER APPROVAL)
1. **CRITICAL: Check Git Status**: Use Bash tool to check current git status and ensure on master/main
2. **CRITICAL: Create Feature Branch**: MUST use mcp__github__create_branch following plan recommendations BEFORE any implementation
3. **Update TaskMaster**: 
   - Set ONLY the specific task status to "in_progress" using mcp__taskmaster-ai__set_task_status
   - Add implementation notes using mcp__taskmaster-ai__update_task
4. **Initialize Todo List**: Use TodoWrite to create implementation todos based on approved plan
5. **Execute Implementation**: Follow the approved plan step by step:
   - Mark each step as in_progress using TodoWrite
   - Implement the step completely
   - Update TaskMaster with progress using mcp__taskmaster-ai__update_task
   - Mark as completed using TodoWrite
   - Provide brief progress updates
6. **Testing**: Implement and run tests as defined in the plan
7. **Validation**: Ensure all success criteria are met
8. **Complete ONLY Current Task**: Set ONLY the current task status to "done" using mcp__taskmaster-ai__set_task_status
9. **STOP EXECUTION**: Do NOT automatically progress to next task - inform user of completion and wait for next instruction

### Phase 4: Iteration Support
If modifications are needed during planning or implementation:

1. **Analyze Feedback**: Review user feedback and current implementation state
2. **Update Plan**: Create an updated plan that:
   - Incorporates the user's feedback
   - Accounts for the current implementation state
   - Provides clear next steps
   - Maintains continuity with completed work
   - Updates TaskMaster tasks accordingly
3. **Present Updated Plan**: Use exit_plan_mode to present the updated plan for approval
4. **Return to Phase 2**: Wait for user approval of updated plan

## TaskMaster Integration Guidelines

### Core MCP Tools Usage
- **mcp__taskmaster-ai__get_tasks**: View all tasks, filter by status
- **mcp__taskmaster-ai__next_task**: Find recommended next task
- **mcp__taskmaster-ai__get_task**: Get specific task details
- **mcp__taskmaster-ai__add_task**: Create new tasks if needed
- **mcp__taskmaster-ai__update_task**: Update task information and add progress notes
- **mcp__taskmaster-ai__set_task_status**: Change task status (pending, in_progress, done, etc.)
- **mcp__taskmaster-ai__expand_task**: Break tasks into subtasks
- **mcp__taskmaster-ai__analyze_project_complexity**: Analyze task complexity

### Task Status Management
- **Before starting**: Set task status to "in_progress"
- **During work**: Use update_task to log progress and notes
- **After completion**: Set task status to "done"
- **If blocked**: Set status to "blocked" and add notes about blockers

### Implementation Tracking
- Use TaskMaster tasks to track implementation progress
- Log technical decisions and challenges in task updates
- Link commits to task IDs in commit messages
- Update task details with final implementation notes

## Thinking Level Assessment

Determine thinking level based on task characteristics:

- **"think"**: Simple bug fixes, documentation updates, minor tweaks
- **"think hard"**: New features, refactoring, integration tasks
- **"think harder"**: Complex features, architectural changes, multi-system integration
- **"ultrathink"**: System design, major architectural decisions, complex problem solving

## Error Handling

- If planning fails, retry with simpler thinking level
- If implementation encounters blockers, pause and request user guidance
- If iterations create conflicts, present options to user for resolution
- Always maintain context between sub-agent launches
- Update TaskMaster with any blockers or issues encountered

## Integration Guidelines

- Use TodoWrite for progress tracking throughout all phases
- Use TaskMaster MCP tools for task management and context
- Maintain context between sub-agent launches
- Provide clear status updates at each phase transition
- **CRITICAL**: Always check current git status before making changes
- **CRITICAL**: Follow project branching strategy from CLAUDE.md - MUST create feature branch BEFORE implementation
- Link all work to TaskMaster task IDs

## EXECUTION SAFEGUARDS

**MANDATORY WORKFLOW ENFORCEMENT:**
1. **Phase 1**: MUST create comprehensive plan for SINGLE task only
2. **Phase 2**: MUST present plan and WAIT for explicit user approval
3. **Phase 3**: MUST check git status and create feature branch BEFORE any implementation
4. **Never skip planning phase** - all work must be planned and approved first
5. **Never implement without feature branch** - all work must be done on feature branches
6. **SINGLE TASK RULE**: NEVER work on multiple tasks in one execution - focus on ONE task only
7. **NO AUTO-PROGRESSION**: NEVER automatically move to next task after completion - STOP and wait for user instruction

**VIOLATION PREVENTION:**
- If you find yourself implementing without a plan → STOP and restart with planning
- If you find yourself on master/main during implementation → STOP and create feature branch
- If you skip user approval → STOP and present plan for approval
- If you bypass any phase → STOP and follow the correct workflow
- **If you start working on multiple tasks → STOP and focus on ONE task only**
- **If you automatically progress to next task → STOP and inform user of completion**
- **If you continue beyond the planned single task → STOP and wait for new instructions**

**COMPLETION PROTOCOL:**
- After completing the planned single task, you MUST:
  1. Set only the current task status to "done"
  2. Provide completion summary
  3. Suggest next logical task but DO NOT implement it
  4. Wait for user to decide next action (new /execute command, different task, etc.)

## Examples

### Simple Task
```
/execute "Fix the typo in the header component"
```
- Planning uses "think" level
- Check TaskMaster for existing UI/component tasks
- Focus on ONLY the typo fix (one subtask)
- Simple 3-step plan with TaskMaster updates
- Quick approval and implementation
- **STOPS** after fixing typo - suggests next task but waits for user

### Complex Task - Single Task Focus
```
/execute "Implement Auth.js middleware setup"
```
- Planning uses "think hard" level
- Map to existing TaskMaster authentication task #3 ONLY
- Focus ONLY on middleware implementation (complete task)
- Comprehensive planning for this specific task
- **STOPS** after middleware is complete - does NOT continue to other tasks
- Suggests next task but waits for user instruction

### Highly Complex Task - Single Task Focus
```
/execute "Set up core messaging infrastructure"
```
- Planning uses "think harder" level
- Check TaskMaster for messaging system tasks (likely task #11)
- Focus ONLY on core infrastructure setup (one main task)
- Does NOT implement full messaging system in one go
- **STOPS** after infrastructure is complete
- Suggests next logical task but waits for user

