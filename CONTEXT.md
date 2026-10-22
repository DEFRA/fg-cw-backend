# Domain language

## Cases

**Workflow Definition**
: The published `cw.json` for one config version of a grant. A config version is only recorded once its Workflow Definition builds a usable Workflow.

**Position**
: Where a case sits in its workflow, written `PHASE:STAGE:STATUS`. Every position a Workflow Definition refers to must be one of its own.

**Current Version**
: The config version a workflow's admin read opens when no version is named: the newest Active one across all majors, even when its workflow file is Failed. A case resolves its workflow differently: to the newest Active version in the requested major whose workflow file is not Failed.
