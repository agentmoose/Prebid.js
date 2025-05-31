# Prebid.js Activity Controls: A Technical Explanation

## 1. Core Concept of Activity Controls

Activity controls in Prebid.js are a centralized and granular mechanism designed to manage privacy-sensitive actions. They serve as building blocks for comprehensive privacy protection within the Prebid.js ecosystem. Rather than a simple on/off switch, activity controls provide a fine-grained, rule-based system. This allows publishers to define and enforce their privacy policies directly within Prebid.js by allowing or disallowing specific "potentially restricted activities" based on a variety of conditions, such as user consent, regulatory requirements, and publisher configurations.

## 2. Defined Activities

Prebid.js defines a set of standard activities that can be subject to controls. These are primarily located in `src/activities/activities.js`. Key activities include:

- **`ACTIVITY_ACCESS_DEVICE` ('accessDevice')**: Governs whether a component (e.g., a User ID module or an adapter) can read from or write to device storage, such as cookies or browser localStorage.
- **`ACTIVITY_SYNC_USER` ('syncUser')**: Controls if a bid adapter is permitted to initiate a user ID synchronization operation (pixel sync).
- **`ACTIVITY_ENRICH_UFPD` ('enrichUfpd')**: Manages whether a component can add user first-party data (FPD) to bid requests.
- **`ACTIVITY_ENRICH_EIDS` ('enrichEids')**: Controls if a component is allowed to augment bid requests with user IDs (EIDs) obtained from various ID modules.
- **`ACTIVITY_FETCH_BIDS` ('fetchBids')**: Determines if a bid adapter is allowed to make a call to its endpoint to fetch bids during an auction.
- **`ACTIVITY_REPORT_ANALYTICS` ('reportAnalytics')**: Governs whether an analytics adapter can send collected analytics data to its backend.
- **`ACTIVITY_TRANSMIT_EIDS` ('transmitEids')**: Controls if a component can access and transmit existing user IDs (which it might have received or generated) to an external endpoint.
- **`ACTIVITY_TRANSMIT_UFPD` ('transmitUfpd')**: Manages whether a component can access and transmit existing user first-party data to an external endpoint.
- **`ACTIVITY_TRANSMIT_PRECISE_GEO` ('transmitPreciseGeo')**: Controls if a component is allowed to access and transmit precise geolocation data.
- **`ACTIVITY_TRANSMIT_TID` ('transmitTid')**: Governs the transmission of transaction IDs by components.
- **`LOAD_EXTERNAL_SCRIPT` ('loadExternalScript')**: Determines if `adloader.js` (or similar mechanisms) can load external JavaScript files, often used by modules or adapters.

## 3. The Rule-Based System

The activity control framework is built upon a rule-based system, primarily defined in `src/activities/rules.js`.

- **Rule Registry**: A central registry holds all rules. Each activity type has an associated list of rules. Rules are stored with a name, the rule function itself, and a priority.
- **Registering Rules (`registerActivityControl`)**: Modules or other parts of Prebid.js can add rules using `pbjs.registerActivityControl(activity, ruleName, ruleFunction, priority)`.
    - `activity`: The name of the activity the rule applies to.
    - `ruleName`: A descriptive name for logging and debugging.
    - `ruleFunction`: A function that receives activity-specific parameters (e.g., component name, details of the data being accessed). This function must return an object like `{allow: boolean, reason?: string}` or `null/undefined` if it abstains from making a decision.
    - `priority`: A number (default 10). Lower numbers indicate higher priority. Publisher-defined rules (e.g., via `pbjs.setConfig`) often get a higher priority (e.g., 1) than module-registered rules.
- **Checking Activity Allowance (`isActivityAllowed`)**: When a component attempts a restricted activity, Prebid.js calls `pbjs.isActivityAllowed(activity, params)`.
    - The system evaluates rules for that activity, starting from the highest priority.
    - If any rule at a given priority level returns `{allow: false}`, the activity is denied, and the check usually stops (unless a higher-priority rule already explicitly allowed it).
    - If a rule returns `{allow: true}`, it's a vote to allow. The system continues checking other rules at the same priority (as a `false` could still override) and then proceeds to lower priority groups if no denial occurs.
    - **Default Allowance**: If no rule explicitly denies the activity (i.e., no rule returns `{allow: false}` that isn't superseded by a higher-priority allow), the activity is permitted by default.

## 4. Example: MSPA and GPP Integration

A prime example of activity controls in action is the MSPA (Multi-State Privacy Agreement) integration, typically handled via the GPP (Global Privacy Platform) framework and materialized in `libraries/mspa/activityControls.js`.

- **How it Works**: This module listens for MSPA consent signals parsed from a GPP string. Based on these signals, it dynamically registers rules using `registerActivityControl`.
- **Rule Registration**: The `setupRules` function within this module maps specific MSPA consent states to rules for activities. For instance:
    - **`isConsentDenied(consentData)`**: This function checks various MSPA flags like `MspaServiceProviderMode`, `Gpc` (Global Privacy Control), and opt-outs for "Sale," "Sharing," or "TargetedAdvertising." If any of these indicate a lack of consent or an opt-out, `isConsentDenied` returns `true`.
    - This result is then used to register rules. If `isConsentDenied` is `true`, rules for activities like `ACTIVITY_SYNC_USER` and `ACTIVITY_ENRICH_EIDS` will be registered to return `{allow: false}`.
- **Specific Consents (e.g., Precise Geolocation)**:
    - **`isTransmitGeoConsentDenied(consentData)`**: This function specifically checks the MSPA consent for processing precise geolocation data (e.g., `SensitiveDataProcessing[7]`). If consent is denied, it registers a rule to block `ACTIVITY_TRANSMIT_PRECISE_GEO`.
    - Similarly, `isTransmitUfpdConsentDenied` handles broader user first-party data transmission, considering various sensitive data categories.

This demonstrates how user consent choices, communicated via GPP, are translated into actionable rules within Prebid.js, directly impacting data processing activities.

## 5. Configuration Aspects

While activity controls are primarily driven by dynamic consent signals, some configuration aspects exist:

- **Consent-Driven**: The most significant factor influencing activity controls is user consent. Modules like `consentManagementGpp` (for GPP/MSPA/TCF) or `consentManagementTcf` interpret CMP data and register activity rules accordingly.
- **`pbjs.setConfig({ allowActivities: { ... } })`**: Publishers can define specific, high-priority rules directly in their Prebid.js configuration. For example:
  `pbjs.setConfig({ allowActivities: { accessDevice: { rules: [{ componentName: 'someModule', allow: false }] }} });`
  This provides a way to override default behaviors or consent-derived rules for specific components or conditions.
- **`deviceAccess` Setting**: The global `pbjs.setConfig({ deviceAccess: boolean })` (default `true`) is a general signal. If set to `false`, it indicates an intent to disallow device storage access. Prebid utilities that access storage often check both `config.getConfig('deviceAccess')` and the outcome of `isActivityAllowed(ACTIVITY_ACCESS_DEVICE, ...)`. However, a specific `allowActivities` rule for `ACTIVITY_ACCESS_DEVICE` can override `deviceAccess: false` due to rule priorities.
- **Module-Specific Configurations**: Individual modules (bidders, analytics, User ID modules) have their own configurations. While these enable or configure module features, the module's ability to perform privacy-sensitive actions is still subject to the overarching activity control system. If an activity required by a configured module is denied by an activity control rule (e.g., due to lack of consent), the action will be blocked.

## 6. Summary of Technical Details

In essence, Prebid.js activity controls are:

- **Dynamic and Programmatic**: Their behavior is determined at runtime, based on the current set of registered rules and context.
- **Consent-Centric**: The primary driver for rule registration and behavior is user consent, typically obtained from a CMP and processed through frameworks like GPP. Modules interpret these signals and translate them into allow/deny rules for specific activities.
- **Not a Single Config File**: There isn't one static configuration file that defines all activity control behavior. Instead, it's a code-driven, event-based mechanism. Control emerges from the interplay of the core framework, dynamically registered rules (often from consent modules), and optional publisher overrides via `pbjs.setConfig`.

This system provides Prebid.js with the flexibility to adapt to diverse privacy regulations and user preferences by integrating consent directly into its operational logic.
