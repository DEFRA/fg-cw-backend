# Canonical acceptance specification — FGP-1221 (backend port)
#
# Driving port:  HTTP GET /cases/report   (Hapi route: src/cases/routes/report-cases.route.js)
# Driven adapter: MongoDB `cases` collection aggregation
#                 (src/cases/repositories/case.repository.js → countByPosition)
#
# There is no Cucumber runner in this repo. These scenarios are the human-readable
# contract; the EXECUTABLE binding for each is the named vitest test listed under
# `Tested by:`. Keep this file and those tests in step.

Feature: Case lifecycle report by position
  As a caseworker
  I want to see how many cases sit at each point in their lifecycle
  So that I can understand where work is building up for a given case type

  @walking_skeleton @driving_adapter
  Scenario: Caseworker reports a case type they are allowed to see
    # Tested by: routes/report-cases.route.test.js
    #            "returns the report wrapped in a page response"
    #            use-cases/report-cases.use-case.test.js "reports the requested case type"
    Given I am a caseworker permitted to see the "Woodland" case type
    When I ask for the report for "Woodland"
    Then I see the number of cases at each lifecycle position
    And the page shows the navigation available to me

  Scenario: Counts roll up from status to stage to phase
    # Tested by: use-cases/report-cases.use-case.test.js
    #            "rolls counts up phase > stage > status and totals them"
    Given cases of a type are spread across several phases, stages and statuses
    When the report is produced
    Then each status shows its own count
    And each stage shows the sum of its statuses
    And each phase shows the sum of its stages
    And the report shows the grand total

  Scenario: Positions holding no cases are not shown
    # Tested by: use-cases/report-cases.use-case.test.js
    #            "omits positions that hold no cases"
    Given a case type whose definition has positions no case currently occupies
    When the report is produced
    Then only positions that hold at least one case appear

  @edge
  Scenario: A case at a position no longer in the definition is still counted
    # Tested by: use-cases/report-cases.use-case.test.js
    #            "surfaces positions not present in the workflow definition rather than dropping them"
    Given a case sits at a position that has since been removed from its definition
    When the report is produced
    Then that case still appears under its recorded position
    And the grand total still reconciles with the number of cases

  Scenario: Only permitted case types are offered, in a stable order
    # Tested by: use-cases/report-cases.use-case.test.js
    #            "restricts available case types to the user's roles"
    Given I am permitted to see more than one case type
    When I open the report
    Then I can only choose from the case types my role permits
    And they are listed in a predictable order

  Scenario: The report defaults to the first available case type
    # Tested by: use-cases/report-cases.use-case.test.js
    #            "defaults to the first available case type when none is requested"
    Given I have not yet chosen a case type
    When I open the report
    Then it shows the first case type available to me

  @edge
  Scenario: Choosing a case type I cannot see falls back safely
    # Tested by: use-cases/report-cases.use-case.test.js
    #            "falls back to the first case type when the requested one is unavailable"
    Given I ask for a case type I am not permitted to see
    When the report is produced
    Then it falls back to the first case type available to me

  @edge
  Scenario: A user with no permitted case types sees an empty report
    # Tested by: use-cases/report-cases.use-case.test.js
    #            "returns an empty report when the user has no accessible case types"
    Given I am permitted to see no case types
    When I open the report
    Then I see an empty report
    And no counting is attempted

  Scenario: Choosing a case type filters the report to it
    # Tested by: routes/report-cases.route.test.js
    #            "passes the requested case type through to the use case"
    Given I choose the "Woodland" case type
    When the report is produced
    Then only "Woodland" cases are counted

  @adapter-integration
  Scenario: Counting groups cases by their lifecycle position
    # Tested by: repositories/case.repository.test.js
    #            "groups cases by phase, stage and status and sums each group"
    #            "returns an empty list when no cases match"
    Given cases stored for a case type
    When the cases are counted by position
    Then each distinct position has a total
    And asking for a case type with no cases returns nothing rather than an error
