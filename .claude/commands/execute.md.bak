---
description: Execute SINGLE tasks using TaskMaster AI with mandatory planning, user approval, and no auto-progression
---

# CRITICAL: SINGLE TASK EXECUTION ONLY

This command implements **EXACTLY ONE** task or subtask at a time and **NEVER** automatically progresses to the next task. After completion, it STOPS and waits for user instruction.

## Full Task List
!`Bash(task-master list)`

## Your Current task

### Phase 1: Planning Mode (MANDATORY - NEVER SKIP)
1. **Launch Planning Sub-Agent**: Use the Task tool to create a planning sub-agent that will:
   - Analyze the user's request thoroughly
   - Check existing TaskMaster tasks for context using mcp__taskmaster-ai__get_tasks
   - Find the most relevant task using mcp__taskmaster-ai__next_task or mcp__taskmaster-ai__get_task
   - Assess task complexity using mcp__taskmaster-ai__complexity_report and determine appropriate thinking level:
     - Simple tasks → "think" 
     - Moderate complexity → "think hard"
     - Complex tasks → "think harder" 
     - Highly complex tasks → "ultrathink"
   - Review current codebase state and implementation progress
   - Create a comprehensive execution plan

2. **Planning Sub-Agent Instructions**:
   ```
   You are a planning sub-agent for the execute command. Your task is to create a comprehensive plan for the following request:

   USER REQUEST: {user_request}

   CRITICAL: Focus on implementing ONLY ONE SPECIFIC TASK/SUBTASK. Do NOT plan for multiple tasks or automatic progression to next tasks.

   First, check the current TaskMaster tasks and find the most relevant SINGLE task:
   1. Use mcp__taskmaster-ai__get_tasks to see all available tasks
   2. Use mcp__taskmaster-ai__next_task to find the recommended next task
   3. Use mcp__taskmaster-ai__get_task with specific ID if user mentioned one
   4. **CRITICAL**: Select ONLY ONE task or subtask to implement

   {thinking_level} about this SINGLE task and create a detailed plan that includes:

   1. **Single Task Focus**: Clearly identify the ONE task/subtask being implemented
   2. **Task Analysis**: Break down ONLY this specific request into core components
   3. **TaskMaster Integration**: Map request to the specific TaskMaster task (no others)
   4. **Current State Assessment**: Review existing code and implementation progress for THIS task only
   5. **Implementation Strategy**: Outline approach and methodology for THIS task only
   6. **Step-by-Step Plan**: Detailed steps with clear deliverables for THIS task only
   8. **Risk Assessment**: Identify potential challenges for THIS task only
   9. **Testing Strategy**: Define testing approach for THIS task only
   10. **Success Criteria**: Define how success will be measured for THIS task only
   11. **TaskMaster Updates**: Plan for updating ONLY this task's status and subtasks
   12. **Execution Boundary**: Clearly state where execution stops (no auto-progression)

   Present the plan in a clear, structured format for user approval.
   
   After creating the plan, use exit_plan_mode to present it to the user.
   ```

### Phase 2: Plan Approval (MANDATORY - WAIT FOR USER APPROVAL)
1. **Present Plan**: The planning sub-agent will present the comprehensive plan
2. **STOP AND WAIT**: Do NOT proceed to implementation until user explicitly approves
3. **Wait for User Response**:
   - If user approves → proceed to Phase 3
   - If user requests modifications → proceed to Phase 4 (Iteration)
   - If user rejects → end execution

### Phase 3: Implementation (ONLY AFTER EXPLICIT USER APPROVAL)
1. **CRITICAL: Check Git Status**: Use Bash tool to check current git status and ensure on master/main
2. **Create Feature Branch**: Create a new feature branch for this task using git checkout -b feature/task-{id}
3. **Update TaskMaster**: 
   - Set ONLY the specific task/subtask status to "in_progress" using mcp__taskmaster-ai__set_task_status
   - Add implementation notes using mcp__taskmaster-ai__update_task or mcp__taskmaster-ai__update_subtask
4. **Initialize Todo List**: Use TodoWrite to create implementation todos based on approved plan
5. **Execute Implementation**: Follow the approved plan step by step:
   - Mark each step as in_progress using TodoWrite
   - Implement the step completely
   - Update TaskMaster with progress using mcp__taskmaster-ai__update_subtask
   - Mark as completed using TodoWrite
   - Provide brief progress updates
6. **Testing**: Implement and run tests as defined in the plan
7. **Validation**: Ensure all success criteria are met
8. **Complete ONLY Current Task**: Set ONLY the current task/subtask status to "done" using mcp__taskmaster-ai__set_task_status
9. **STOP EXECUTION**: Do NOT automatically progress to next task - inform user of completion and wait for next instruction

### Phase 4: Iteration Support
If modifications are needed during planning or implementation:

1. **Launch Iteration Sub-Agent**: Use Task tool with iteration context:
   ```
   You are handling an iteration of the execute command.

   CURRENT TASKMASTER STATE: Use mcp__taskmaster-ai__get_tasks to get current state
   ORIGINAL PLAN: {original_plan}
   CURRENT IMPLEMENTATION STATE: {current_state}
   USER FEEDBACK: {user_feedback}

   {thinking_level} about the user's feedback and current state. Create an updated plan that:
   1. Incorporates the user's feedback
   2. Accounts for the current implementation state
   3. Provides clear next steps
   4. Maintains continuity with completed work
   5. Updates TaskMaster tasks accordingly

   Present the updated plan for user approval using exit_plan_mode.
   ```

2. **Return to Phase 2**: Present updated plan for approval

## TaskMaster Integration Guidelines

### Core MCP Tools Usage
- **mcp__taskmaster-ai__get_tasks**: View all tasks, filter by status
- **mcp__taskmaster-ai__next_task**: Find recommended next task
- **mcp__taskmaster-ai__get_task**: Get specific task details
- **mcp__taskmaster-ai__add_task**: Create new tasks if needed
- **mcp__taskmaster-ai__update_task**: Update main task information
- **mcp__taskmaster-ai__update_subtask**: Add progress notes to subtasks
- **mcp__taskmaster-ai__set_task_status**: Change task status (pending, in_progress, done, etc.)
- **mcp__taskmaster-ai__expand_task**: Break tasks into subtasks
- **mcp__taskmaster-ai__analyze_project_complexity**: Analyze task complexity

### Task Status Management
- **Before starting**: Set task status to "in_progress"
- **During work**: Use update_subtask to log progress and notes
- **After completion**: Set task status to "done"
- **If blocked**: Set status to "blocked" and add notes about blockers

### Implementation Tracking
- Use TaskMaster subtasks to track implementation steps
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
- Link all work to TaskMaster task IDs

## EXECUTION SAFEGUARDS

**MANDATORY WORKFLOW ENFORCEMENT:**
1. **Phase 1**: MUST launch planning sub-agent and create comprehensive plan for SINGLE task only
2. **Phase 2**: MUST present plan and WAIT for explicit user approval
4. **Never skip planning phase** - all work must be planned and approved first
6. **SINGLE TASK RULE**: NEVER work on multiple tasks in one execution - focus on ONE task/subtask only
7. **NO AUTO-PROGRESSION**: NEVER automatically move to next task after completion - STOP and wait for user instruction

**VIOLATION PREVENTION:**
- If you find yourself implementing without a plan → STOP and restart with planning
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

### Complex Task - Single Subtask Focus
```
/execute "Implement Auth.js middleware setup"
```
- Planning uses "think hard" level
- Map to existing TaskMaster authentication task #3, subtask #4 ONLY
- Focus ONLY on middleware implementation (not full auth system)
- Comprehensive planning for this specific subtask
- **STOPS** after middleware is complete - does NOT continue to UI components
- Suggests next subtask (3.5) but waits for user instruction

### Highly Complex Task - Single Task Focus
```
/execute "Set up core messaging infrastructure"
```
- Planning uses "think harder" level
- Check TaskMaster for messaging system tasks (likely task #11)
- Focus ONLY on core infrastructure setup (one main task)
- Does NOT implement full messaging system in one go
- **STOPS** after infrastructure is complete
- Suggests breaking into subtasks or next logical step but waits for user

## Project-Specific Context

- **Project Root**: /Users/asafatzmon/dev/book-borrow
- **TaskMaster Tasks**: Book borrowing/lending system with 20 main tasks
- **Current Status**: Task #1 (Setup) completed, Task #2 (Prisma) pending
- **Next Priority**: Authentication system (Task #3) with 5 subtasks
- **Technology Stack**: Next.js, TypeScript, TailwindCSS, Auth.js v5, Prisma, Docker