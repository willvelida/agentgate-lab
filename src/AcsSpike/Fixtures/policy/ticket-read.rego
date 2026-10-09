package agentgate.ticket_read

import rego.v1

default pre_tool_verdict := {"decision": "deny", "reason": "ticket_read_not_permitted"}
default post_tool_verdict := {"decision": "deny", "reason": "ticket_result_not_permitted"}

pre_tool_verdict := {"decision": "allow", "reason": "ticket_read_permitted"} if {
    input.intervention_point == "pre_tool_call"
    input.tool.name == "tickets.read"
    input.snapshot.task.ticketReadPermitted == true
    input.policy_target.value.ticketId == "SYN-001"
}

post_tool_verdict := {"decision": "allow", "reason": "synthetic_ticket_result"} if {
    input.intervention_point == "post_tool_call"
    input.tool.name == "tickets.read"
    input.snapshot.task.ticketReadPermitted == true
    input.policy_target.value.ticketId == "SYN-001"
    input.policy_target.value.title == "Synthetic ticket"
}
