---
description: Execute SINGLE TaskMaster tasks with structured planning, user approval, and controlled execution
version: 2.0
---

```xml
<command>
  <metadata>
    <name>execute_task</name>
    <version>2.0</version>
    <description>Execute a single TaskMaster task with mandatory planning, user approval, and controlled execution</description>
    <author>TaskMaster AI Integration</author>
  </metadata>

  <parameters>
    <parameter name="task_id" type="string" required="false" default="next_task">
      <description>Specific TaskMaster task ID to execute (e.g., "1.3" or "next")</description>
      <validation>Must be valid TaskMaster task ID format or "next"</validation>
    </parameter>
    <parameter name="thinking_level" type="enum" required="false" default="auto">
      <description>Cognitive complexity level for planning</description>
      <values>
        <value name="think">Simple tasks, bug fixes, documentation</value>
        <value name="think_hard">New features, refactoring, integration</value>
        <value name="think_harder">Complex features, architectural changes</value>
        <value name="ultrathink">System design, major architectural decisions</value>
        <value name="auto">Automatically determine based on task complexity</value>
      </values>
    </parameter>
  </parameters>

  <context_gathering>
    <environment>
      <git_status>!`Bash(git status --porcelain)`</git_status>
      <git_branch>!`Bash(git branch --show-current)`</git_branch>
    </environment>
    <taskmaster_state>
      <all_tasks>!`Bash(task-master list | sed '/Suggested Next Steps/,$d')`</all_tasks>
      <next_task>!`Bash(task-master next)`</next_task>
      <current_tag>!`Bash(task-master list-tags | grep "Current:" | head -1)`</current_tag>
    </taskmaster_state>
  </context_gathering>

  <workflow>
    <phase id="1" name="initialization">
      <description>Initialize execution environment and gather context</description>
      <steps>
        <step id="1.1" name="validate_environment">
          <action>Check git status and ensure clean working directory</action>
          <tools>Bash</tools>
          <critical>true</critical>
        </step>
        <step id="1.2" name="determine_task">
          <action>Resolve target task ID from user input or next available task</action>
          <tools>mcp__taskmaster-ai__get_task, mcp__taskmaster-ai__next_task</tools>
          <output>Specific TaskMaster task ID and details</output>
        </step>
        <step id="1.3" name="fetch_task_details">
          <action>Retrieve comprehensive task information</action>
          <tools>mcp__taskmaster-ai__get_task</tools>
          <output>Full task context including dependencies, subtasks, and current status</output>
        </step>
      </steps>
    </phase>

    <phase id="2" name="planning">
      <description>Create comprehensive implementation plan using sub-agent</description>
      <steps>
        <step id="2.1" name="launch_planning_agent">
          <action>Launch dedicated planning sub-agent</action>
          <sub_agent>
            <goal>Create comprehensive implementation plan for SINGLE TaskMaster task</goal>
            <constraints>
              <constraint>Focus on ONE specific task/subtask only</constraint>
              <constraint>No automatic progression to other tasks</constraint>
              <constraint>Must use TaskMaster research for technical details</constraint>
            </constraints>
            <required_outputs>
              <output name="task_identification">Single task being implemented</output>
              <output name="task_analysis">Breakdown of task components</output>
              <output name="current_state">Assessment of existing implementation</output>
              <output name="implementation_strategy">Detailed approach and methodology</output>
              <output name="step_by_step_plan">Granular steps with deliverables</output>
              <output name="risk_assessment">Potential challenges and mitigation</output>
              <output name="testing_strategy">Verification and validation approach</output>
              <output name="success_criteria">Definition of completion</output>
              <output name="taskmaster_updates">Plan for status and progress tracking</output>
              <output name="execution_boundary">Clear stopping point</output>
            </required_outputs>
            <tools>
              <tool>mcp__taskmaster-ai__get_tasks</tool>
              <tool>mcp__taskmaster-ai__get_task</tool>
              <tool>mcp__taskmaster-ai__research</tool>
              <tool>mcp__taskmaster-ai__analyze_project_complexity</tool>
              <tool>Read, Glob, Grep</tool>
            </tools>
            <completion_action>exit_plan_mode</completion_action>
          </sub_agent>
        </step>
      </steps>
    </phase>

    <phase id="3" name="user_approval">
      <description>Present plan to user and handle feedback</description>
      <checkpoint id="plan_approval">
        <prompt>Review the implementation plan and choose your action:</prompt>
        <options>
          <option value="approve" next_phase="4">Approve plan and begin implementation</option>
          <option value="modify" next_phase="3.1">Request modifications to plan</option>
          <option value="reject" action="abort">Reject plan and exit</option>
        </options>
      </checkpoint>

      <sub_phase id="3.1" name="plan_iteration">
        <description>Handle plan modifications based on user feedback</description>
        <steps>
          <step id="3.1.1" name="analyze_feedback">
            <action>Process user feedback and determine required changes</action>
            <tools>mcp__taskmaster-ai__get_tasks</tools>
          </step>
          <step id="3.1.2" name="revise_plan">
            <action>Create updated plan incorporating feedback</action>
            <sub_agent>
              <goal>Revise implementation plan based on user feedback</goal>
              <inputs>
                <input name="original_plan">Previous planning output</input>
                <input name="user_feedback">User's requested changes</input>
                <input name="current_state">Current implementation state</input>
              </inputs>
              <completion_action>exit_plan_mode</completion_action>
            </sub_agent>
          </step>
          <step id="3.1.3" name="re_approval">
            <action>Present revised plan for approval</action>
            <checkpoint_ref>plan_approval</checkpoint_ref>
          </step>
        </steps>
      </sub_phase>
    </phase>

    <phase id="4" name="implementation">
      <description>Execute the approved implementation plan</description>
      <steps>
        <step id="4.1" name="setup_tracking">
          <action>Initialize progress tracking systems</action>
          <sub_steps>
            <sub_step>Set TaskMaster task status to "in_progress"</sub_step>
            <sub_step>Create TodoWrite list based on approved plan</sub_step>
            <sub_step>Add initial implementation notes to TaskMaster</sub_step>
          </sub_steps>
          <tools>mcp__taskmaster-ai__set_task_status, TodoWrite, mcp__taskmaster-ai__update_task</tools>
        </step>

        <step id="4.2" name="execute_plan">
          <action>Implement each step of the approved plan</action>
          <iteration_pattern>
            <for_each>planned_step</for_each>
            <actions>
              <action>Mark step as in_progress in TodoWrite</action>
              <action>Execute implementation step</action>
              <action>Update TaskMaster with progress notes</action>
              <action>Mark step as completed in TodoWrite</action>
              <action>Provide brief progress update</action>
            </actions>
          </iteration_pattern>
          <tools>TodoWrite, mcp__taskmaster-ai__update_subtask, Edit, MultiEdit, Write, Bash</tools>
          
          <troubleshooting_protocol>
            <when_problems_occur>
              <description>If any errors, blockers, or unexpected issues arise during implementation</description>
              <mandatory_actions>
                <action priority="1">IMMEDIATELY use mcp__taskmaster-ai__research to investigate the problem</action>
                <action priority="2">Include specific error messages, technology stack, and context in research query</action>
                <action priority="3">Apply research findings to resolve the issue</action>
                <action priority="4">Update TaskMaster with both problem and solution details</action>
                <action priority="5">If research doesn't solve the issue, use research again with refined query</action>
              </mandatory_actions>
              <research_query_examples>
                <example>How to fix TypeScript error "Cannot find module" in Next.js 15 project</example>
                <example>TailwindCSS classes not applying in Next.js src directory setup</example>
                <example>Auth.js middleware configuration issues with Next.js 15</example>
                <example>React component rendering errors with TypeScript strict mode</example>
              </research_query_examples>
              <escalation_criteria>
                <criterion>If multiple research attempts don't resolve the issue</criterion>
                <criterion>If the problem requires architectural changes not in the original plan</criterion>
                <criterion>If external dependencies or services are unavailable</criterion>
                <response>Update TaskMaster with detailed problem description and request user guidance</response>
              </escalation_criteria>
            </when_problems_occur>
          </troubleshooting_protocol>
        </step>

        <step id="4.3" name="testing_validation">
          <action>Execute testing strategy from approved plan</action>
          <sub_steps>
            <sub_step>Run automated tests if applicable</sub_step>
            <sub_step>Perform manual validation</sub_step>
            <sub_step>Verify success criteria are met</sub_step>
            <sub_step>Document test results in TaskMaster</sub_step>
          </sub_steps>
          <tools>Bash, mcp__taskmaster-ai__update_subtask</tools>
          
          <testing_troubleshooting>
            <when_tests_fail>
              <description>If tests fail, validation doesn't pass, or success criteria aren't met</description>
              <mandatory_research_actions>
                <action>Use mcp__taskmaster-ai__research to investigate test failures or validation issues</action>
                <action>Research best practices for the specific testing scenario</action>
                <action>Research common issues with the technology stack being tested</action>
                <action>Apply research findings to fix tests or validation</action>
                <action>Document the problem and solution in TaskMaster</action>
              </mandatory_research_actions>
              <research_focus_areas>
                <area>Test framework configuration and setup</area>
                <area>Common testing patterns for the technology stack</area>
                <area>Debugging strategies for specific test failures</area>
                <area>Integration testing best practices</area>
              </research_focus_areas>
            </when_tests_fail>
          </testing_troubleshooting>
        </step>

        <step id="4.4" name="completion">
          <action>Finalize task completion</action>
          <sub_steps>
            <sub_step>Set TaskMaster task status to "done"</sub_step>
            <sub_step>Add final implementation notes</sub_step>
            <sub_step>Update TodoWrite with completion status</sub_step>
            <sub_step>Commit changes if appropriate</sub_step>
          </sub_steps>
          <tools>mcp__taskmaster-ai__set_task_status, mcp__taskmaster-ai__update_task, TodoWrite, Bash</tools>
        </step>
      </steps>
    </phase>

    <phase id="5" name="completion_protocol">
      <description>Controlled completion without auto-progression</description>
      <steps>
        <step id="5.1" name="completion_summary">
          <action>Provide comprehensive completion summary</action>
          <required_content>
            <content>Task completed and key deliverables</content>
            <content>Any issues encountered and resolved</content>
            <content>Current TaskMaster status</content>
            <content>Testing results and validation</content>
          </required_content>
        </step>

        <step id="5.2" name="suggest_next">
          <action>Suggest logical next steps WITHOUT implementing them</action>
          <tools>mcp__taskmaster-ai__next_task</tools>
          <constraint>MUST NOT automatically execute next task</constraint>
        </step>

        <step id="5.3" name="await_instruction">
          <action>Wait for explicit user instruction for next action</action>
          <prompt>Task completed. What would you like to do next?</prompt>
        </step>
      </steps>
    </phase>
  </workflow>

  <integration_specifications>
    <taskmaster_integration>
      <required_tools>
        <tool name="mcp__taskmaster-ai__get_tasks" purpose="View all tasks and status"/>
        <tool name="mcp__taskmaster-ai__next_task" purpose="Find recommended next task"/>
        <tool name="mcp__taskmaster-ai__get_task" purpose="Get specific task details"/>
        <tool name="mcp__taskmaster-ai__set_task_status" purpose="Update task status"/>
        <tool name="mcp__taskmaster-ai__update_task" purpose="Add task-level notes"/>
        <tool name="mcp__taskmaster-ai__update_subtask" purpose="Add subtask progress notes"/>
        <tool name="mcp__taskmaster-ai__research" purpose="Research technical details"/>
        <tool name="mcp__taskmaster-ai__analyze_project_complexity" purpose="Assess task complexity"/>
      </required_tools>

      <status_lifecycle>
        <status name="pending" description="Task ready for work"/>
        <status name="in_progress" description="Task currently being implemented"/>
        <status name="done" description="Task completed successfully"/>
        <status name="blocked" description="Task waiting on external factors"/>
        <status name="deferred" description="Task postponed"/>
        <status name="cancelled" description="Task no longer needed"/>
      </status_lifecycle>

      <progress_tracking>
        <task_level>Use update_task for major milestones and decisions</task_level>
        <subtask_level>Use update_subtask for detailed progress logging</subtask_level>
        <timestamping>All updates include automatic timestamps</timestamping>
        <linking>Link commits to TaskMaster task IDs</linking>
      </progress_tracking>
    </taskmaster_integration>

    <todo_integration>
      <usage>Create TodoWrite lists for implementation tracking</usage>
      <granularity>One todo item per implementation step</granularity>
      <real_time_updates>Update status as work progresses</real_time_updates>
      <completion_tracking>Mark items complete immediately after finishing</completion_tracking>
    </todo_integration>

    <git_integration>
      <pre_implementation>Always check git status before starting</pre_implementation>
      <commit_messages>Include TaskMaster task ID in commit messages</commit_messages>
      <branch_awareness>Respect current branch and don't switch automatically</branch_awareness>
      <clean_state>Ensure working directory is clean before major changes</clean_state>
    </git_integration>
  </integration_specifications>

  <safeguards_and_controls>
    <execution_controls>
      <mandatory_planning>All work must be planned and approved before implementation</mandatory_planning>
      <single_task_focus>Never work on multiple tasks simultaneously</single_task_focus>
      <no_auto_progression>Never automatically move to next task after completion</no_auto_progression>
      <user_approval_required>All plans must receive explicit user approval</user_approval_required>
      <controlled_completion>Execution stops at defined boundary</controlled_completion>
    </execution_controls>

    <violation_detection>
      <implementing_without_plan>
        <detection>If implementation begins without approved plan</detection>
        <response>STOP immediately and restart with planning phase</response>
      </implementing_without_plan>
      <skipping_approval>
        <detection>If plan is not presented for user approval</detection>
        <response>STOP and present plan for explicit approval</response>
      </skipping_approval>
      <multiple_task_work>
        <detection>If work begins on multiple tasks simultaneously</detection>
        <response>STOP and refocus on single approved task</response>
      </multiple_task_work>
      <auto_progression>
        <detection>If automatic progression to next task occurs</detection>
        <response>STOP and wait for user instruction</response>
      </auto_progression>
    </violation_detection>

    <error_handling>
      <planning_failures>
        <condition>Planning sub-agent fails or produces incomplete plan</condition>
        <response>Retry with simplified approach or request user guidance</response>
      </planning_failures>
      <implementation_blockers>
        <condition>Implementation encounters unexpected obstacles</condition>
        <response>
          <step>IMMEDIATELY use mcp__taskmaster-ai__research to investigate the blocker</step>
          <step>Apply research findings to attempt resolution</step>
          <step>If research doesn't resolve the blocker, use research again with refined query</step>
          <step>If multiple research attempts fail, pause execution and update TaskMaster with blocker details</step>
          <step>Request user guidance only after thorough research attempts</step>
        </response>
      </implementation_blockers>
      <context_loss>
        <condition>Context is lost between phases or sub-agents</condition>
        <response>Rebuild context from TaskMaster and TodoWrite state</response>
      </context_loss>
      <tool_failures>
        <condition>TaskMaster or other tools become unavailable</condition>
        <response>Gracefully degrade functionality and notify user</response>
      </tool_failures>
    </error_handling>
  </safeguards_and_controls>

  <examples>
    <example category="simple" complexity="think">
      <input>/execute "Fix typo in header component"</input>
      <process>
        <step>Map to UI component TaskMaster task</step>
        <step>Focus on single typo fix (one subtask)</step>
        <step>Simple 3-step plan with quick approval</step>
        <step>Implement fix and update TaskMaster</step>
        <step>STOP after completion, suggest next but wait</step>
      </process>
      <expected_outcome>Single typo fixed, TaskMaster updated, user notified of completion</expected_outcome>
    </example>

    <example category="moderate" complexity="think_hard">
      <input>/execute "Implement Auth.js middleware setup"</input>
      <process>
        <step>Map to authentication TaskMaster task (e.g., task 3, subtask 4)</step>
        <step>Focus ONLY on middleware implementation</step>
        <step>Comprehensive planning with research</step>
        <step>Implement middleware with progress tracking</step>
        <step>STOP after middleware complete, suggest next subtask but wait</step>
      </process>
      <expected_outcome>Middleware implemented, TaskMaster updated, ready for next auth component</expected_outcome>
    </example>

    <example category="complex" complexity="think_harder">
      <input>/execute "Set up core messaging infrastructure"</input>
      <process>
        <step>Map to messaging system TaskMaster task (e.g., task 11)</step>
        <step>Focus on core infrastructure only</step>
        <step>Detailed planning with architectural considerations</step>
        <step>Implement infrastructure with extensive tracking</step>
        <step>STOP after infrastructure complete, suggest subtask breakdown</step>
      </process>
      <expected_outcome>Core infrastructure established, TaskMaster updated, ready for feature implementation</expected_outcome>
    </example>
  </examples>

  <project_configuration>
    <project_root>/Users/iatzmon/dev/task-master-ui</project_root>
    <project_type>TaskMaster UI system for visual task management</project_type>
    <technology_stack>
      <primary>Next.js 15, TypeScript, React</primary>
      <styling>TailwindCSS</styling>
      <integration>TaskMaster AI MCP</integration>
    </technology_stack>
    <development_patterns>
      <src_directory>Use src/ directory structure</src_directory>
      <component_structure>Follow existing component patterns</component_structure>
      <type_safety>Maintain strict TypeScript compliance</type_safety>
    </development_patterns>
  </project_configuration>
</command>
```
