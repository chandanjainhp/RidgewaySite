# Analysis: Simplified and Secure MCP Gateways for Enterprise AI Integration

## TECHNICAL SUMMARY

The paper proposes an **MCP Gateway** architecture for securing enterprise deployments of Model Context Protocol servers by externalizing authentication, authorization, traffic filtering, and tunneling from backend MCP servers. The architectural argument is introduced in **Section IV**, which states that “the MCP Gateway assumes authorization responsibilities (OAuth 2.1 flows, token validation, identity integration) while MCP servers focus solely on resource provision,” motivated by the claim that the “2025-03-26 MCP specification [2] introduced OAuth 2.1 support” and therefore increased compliance complexity. The implementation is not presented as a novel learning algorithm; it is a systems/security composition of existing components.

The concrete architecture in **Section V / Fig. 2** has five layers: **Security Proxy**, **Authentication Gateway**, **Zero Trust Tunnelling**, **Security Middleware**, and **Backend MCP Servers**. The Security Proxy performs “TLS termination, rate limiting, and forward authentication delegation”; the Authentication Gateway manages “OAuth 2.1 flows,” enterprise IdP integration, and token validation; Zero Trust Tunnelling provides encrypted identity-aware tunnels; Security Middleware performs “deep inspection with threat detection and centralized logging”; and backend MCP servers are simplified tool-execution components. The threat-model mapping in **Table I** links these components to MAESTRO layers and threat classes such as DoS, protocol abuse, data exfiltration, tool poisoning, and injection attacks, with mitigations including WAF rules, scoped tokens, encryption, IDS, and containerization.

The proof-of-concept in **Section VII** is deployed on “a hardened public facing Virtual Private Server (VPS) running Ubuntu Linux (Ubuntu 22.04 64 Bit).” The stack consists of **Pangolin**, **Traefik**, **WireGuard**, **CrowdSec**, Docker, and Anthropic’s **MCP Inspector**, with exact versions listed in **Table II**: e.g., Traefik V3.3.3, CrowdSec V1.6.8, Pangolin V1.2.0, Docker V28.1.1, MCP Inspector V0.10.2. Two **stateless MCP servers** using **Server-Sent Events (SSE)** are used, one local and one cloud-hosted, and the paper states that neither contains built-in authentication. The external testing tools are the **Anthropic MCP Inspector** and **Cloudflare AI Playground** (**Section VII**). The auth flow is described narratively: unauthenticated requests receive a 401, the client discovers metadata via `.well-known/oauth-authorization-server`, authenticates, and retries with a validated token (**Section VII, Fig. 4**).

There are effectively **no datasets** in the ML sense, no training pipeline, and no quantitative task benchmark. Evaluation in **Section VIII** is explicitly **qualitative**: “Qualitative testing showed the gateway's potential,” followed by claims that unauthenticated requests were blocked, invalid tokens rejected, rate limiting and CrowdSec blocked excessive requests, and backend servers were isolated via WireGuard. No numeric security metrics, latency numbers, false-positive rates, attack success rates, ablations, or statistical summaries are reported. The key empirical basis for the paper’s claim is therefore feasibility of a prototype composition rather than measured comparative performance.

## CORE CLAIM

The paper claims that a dedicated MCP Gateway architecture can “simplify secure self-hosted MCP server integration” and “enable secure self-hosting without exposing infrastructure” by centralizing OAuth 2.1 authentication, threat detection, and secure tunneling for enterprise MCP deployments (**Abstract**).

## MAIN RISKS

1. **The core claim of improved security is not supported by quantitative evaluation.**  
   The main evidence in **Section VIII** is “Qualitative testing showed the gateway's potential,” followed by informal statements such as “Traefik blocked unauthenticated requests” and “Traefik rate limiting and CrowdSec blocked excessive requests.” There are no attack success rates, no benchmarked adversarial scenarios, no latency/throughput measurements, and no comparison numbers. This threatens the claim that the architecture “enables secure self-hosting” (**Abstract**) because a practitioner cannot estimate actual security efficacy, operational cost, or failure rates in deployment.

2. **The prototype is heavily confounded by third-party components, so the paper does not isolate what the proposed contribution adds.**  
   The implementation in **Section VII** relies on Pangolin, Traefik, WireGuard, CrowdSec, Let’s Encrypt, Gerbil, Newt, and Badger; **Table II** lists versions of these external tools. Yet the paper attributes observed feasibility to “the MCP Gateway” rather than separating which properties come from standard reverse proxying, VPN tunneling, or off-the-shelf WAF/IDS. This matters because adoption decisions depend on whether the proposed architecture contributes something beyond standard enterprise gateway assembly.

3. **No fair comparison is provided against the stated alternatives.**  
   In **Section VIII**, the paper claims “Standard API Gateways lack MCP-specific threat understanding and Public MCP gateway solutions do not yet fully address enterprise self-hosted needs,” but no experiment, feature matrix, security test, or deployment comparison substantiates this. This is decision-relevant because practitioners choosing among API gateways, service meshes, or existing MCP gateway options need evidence that this design materially outperforms or simplifies their current options.

4. **The deployment story depends on immature infrastructure acknowledged by the paper itself.**  
   **Section VIII** states that “Pangolin… is a relatively new open-source project (less than six months old at the time of writing) and depends on several underlying technologies.” Since Pangolin underpins “the tunnelling and management framework,” this directly weakens the reliability and maintainability of the proposed production architecture. If that component proves unstable or insecure, the paper’s core enterprise-security recommendation fails in practice.

5. **The paper overclaims specification compliance and enterprise suitability without validation breadth.**  
   The Introduction says the Gateway “ensur[es] spec-compliant deployments,” and **Section IX** concludes it supports “robust, secure, scalable, and spec-compliant AI integrations,” but the PoC only demonstrates two stateless SSE servers and a single Ubuntu VPS setup (**Section VII**). No tests across other MCP transports, server implementations, enterprise identity systems beyond “e.g., GitHub, Google,” or multi-tenant environments are reported. This matters because enterprises need assurance beyond a narrow single-stack demonstration.

## DOMAIN-SPECIFIC CONCERNS

1. **The evaluation does not test realistic enterprise identity integration despite enterprise framing.**  
   The paper positions the work around “enterprise identity providers” (**Section V**) and says the forward auth component interacts with “identity providers (e.g., GitHub, Google)” (**Section VII**). GitHub and Google are examples, but common enterprise deployments often require Azure AD/Entra, Okta, SAML/OIDC policy integration, conditional access, SCIM, group claims, and internal PKI. The absence of evaluation on such systems is a domain-specific gap because enterprise IAM interoperability is often the hardest part of deployment.

2. **The PoC uses SSE-only stateless MCP servers, which narrows applicability to a specific MCP deployment regime.**  
   **Section VII** states: “The system includes two stateless MCP servers, implemented with Server-Sent Events (SSE).” In practice, MCP deployments may vary by transport, statefulness, long-lived sessions, or bidirectional semantics. Security controls that work for SSE ingress may not transfer unchanged to other transport patterns. This untested assumption limits the generality of “enterprise MCP adoption” claims (**Section IX**).

3. **Known security tradeoffs of centralized gateways are acknowledged but not evaluated.**  
   **Section VIII** lists “performance overhead from security processes, managing keys/tokens, tuning threat detection rules, and ensuring reliable tunnel management” as limitations. In this subfield, centralized enforcement points can become bottlenecks, single points of failure, and policy drift surfaces. Since the paper does not quantify latency, availability impact, or false-positive behavior of CrowdSec/WAF policies, it omits standard operational-security concerns that materially affect real deployment.

4. **Threat mapping is framework-aligned but not attack-validating.**  
   **Table I** maps components to MAESTRO layers and threat classes, and **Section VI** claims the gateway mitigates “tool poisoning” and “injection attacks” through protocol validation, WAF, IDS, and monitoring. In security engineering, threat-model tables are not substitutes for adversarial validation. The paper does not present attack traces, red-team scenarios, bypass attempts, or measured prevention rates, so the framework mapping risks being purely schematic rather than evidentiary.

5. **The architecture assumes available secure tunneling infrastructure and mesh-style reverse proxying.**  
   The proposed system depends on “Zero Trust Tunnelling” (**Section V**) and specifically on Pangolin/WireGuard-based tunneled reverse proxying (**Section VII**). In many enterprise environments, outbound tunnel creation, mesh overlays, and public-VPS mediation are constrained by networking policy, compliance, or change-management. The paper does not discuss these deployment constraints, though they are central in this domain.

## STRENGTHS

- The paper gives a concrete componentized architecture rather than only high-level motivation, with explicit roles for Security Proxy, Authentication Gateway, Zero Trust Tunnelling, Security Middleware, and Backend MCP Servers (**Section V / Fig. 2**).
- The implementation section is specific about the software stack and versioning, listing exact versions for Traefik, WireGuard, CrowdSec, Pangolin, Docker, and MCP Inspector in **Table II**, which improves reproducibility relative to many systems position papers.
- The auth flow is described at protocol level, including 401 handling, `.well-known/oauth-authorization-server` metadata discovery, and token-based retry behavior (**Section VII, Fig. 4**), making the intended MCP/OAuth interaction understandable.
- The paper explicitly acknowledges limitations, including “complexity of integrating components,” “performance overhead,” “managing keys/tokens,” and the immaturity of Pangolin (**Section VIII**), which is more credible than presenting the deployment as turnkey.
- The threat-model mapping in **Table I** provides a structured linkage between architecture components, threat classes, and mitigations, which may be useful as an engineering checklist even if not empirically validated.

## WEAKNESSES

- The paper’s empirical validation is only qualitative: **Section VIII** begins “Qualitative testing showed the gateway's potential,” with no quantitative metrics, attack benchmark, or statistical evidence.
- The central security claim in the **Abstract** (“enabling secure self-hosting without exposing infrastructure”) is not backed by formal threat evaluation, penetration testing, or measured attack resistance anywhere in **Sections VII–VIII**.
- The claim that the architecture is “validated through implementation” (**Section II**) is weakly supported because the implementation demonstrates only a PoC composition on a single Ubuntu VPS with two SSE servers (**Section VII**), not robust validation across environments.
- The comparison claim in **Section VIII**—“Standard API Gateways lack MCP-specific threat understanding and Public MCP gateway solutions do not yet fully address enterprise self-hosted needs”—has no corresponding comparative experiment or feature analysis.
- The architecture’s claimed benefits are inseparable from third-party tools: Pangolin, Traefik, WireGuard, CrowdSec, Let’s Encrypt, Gerbil, Newt, and Badger are all core to the implementation (**Section VII**), but no ablation shows which are necessary or sufficient.
- The paper does not provide latency, throughput, resource overhead, or availability measurements, despite explicitly acknowledging “performance overhead from security processes” in **Section VIII**.
- The threat mappings in **Table I** are asserted rather than validated; for example, “Tool Poisoning” is paired with “Threat detection (IDS), Content security policies, Input validation,” but no test demonstrates detection or prevention performance.
- The paper claims “spec-compliant deployments” in the **Introduction** and “spec-compliant AI integrations” in **Section IX**, yet only one transport regime (SSE) and one prototype path are exercised in **Section VII**.
- No baseline is established against a simpler setup such as direct MCP server + native OAuth, standard API gateway, or service-mesh-only deployment, so simplification and security gains are unmeasured (**Sections I, VIII**).
- Reproducibility is partial: while versions are given in **Table II**, the paper does not provide full configuration artifacts in the text, complete hardware sizing, load parameters, or exact test procedures for the claims in **Section VIII**.

## FORENSIC DEEP-DIVE

### Eval Gaps

#### 1. The paper makes a security claim without security measurements.
**Evidence:** The abstract promises “robust security,” “authentication, intrusion detection, and secure tunneling,” and says the system enables “secure self-hosting without exposing infrastructure.” Yet **Section VIII** offers only: “Qualitative testing showed the gateway's potential,” followed by informal checks such as “invalid Authorization tokens were rejected” and “CrowdSec blocked excessive requests.”  
**Why it matters:** Security architecture claims require evidence under attack models. Without attack matrices, blocked/allowed rates, false positives, false negatives, or benchmark scenarios, the paper does not establish that the design materially improves security. For the core claim, “potential” is not enough; enterprises need evidence that specific threats are mitigated at acceptable operational cost.

#### 2. There is no operational evaluation despite acknowledged overhead and complexity.
**Evidence:** **Section VIII** states that “Challenges and risks include the complexity of integrating components, performance overhead from security processes, managing keys/tokens, tuning threat detection rules, and ensuring reliable tunnel management.” No throughput, latency, CPU/memory, tunnel failure recovery, or token-refresh measurements are presented in **Sections VII–VIII**.  
**Why it matters:** A practitioner deciding whether to deploy a gateway needs to know whether it degrades MCP responsiveness, creates bottlenecks, or increases operational burden. The paper itself identifies these issues as important, then leaves them unmeasured.

### Confounds

#### 3. The observed behavior may be attributable to standard infrastructure rather than the proposed contribution.
**Evidence:** The PoC in **Section VII** uses Pangolin, Traefik, Let’s Encrypt, WireGuard, CrowdSec, Docker, MCP Inspector, and a custom auth component; **Table II** enumerates versions. Security features described in the results—TLS termination, rate limiting, WAF, tunneling, and auth redirection—are standard capabilities of those tools.  
**Why it matters:** The claimed contribution is an “MCP Gateway” architecture, but the evidence does not separate architectural novelty from ordinary reverse-proxy/VPN/WAF integration. Without ablation or baseline comparison, the paper cannot show what unique value its gateway abstraction adds.

#### 4. The “validated through implementation” claim is much stronger than the implementation evidence.
**Evidence:** **Section II** lists as a contribution “A reference architecture for MCP Gateways validated through implementation.” The implementation in **Section VII** is a single PoC on “a hardened public facing VPS running Ubuntu Linux (Ubuntu 22.04 64 Bit)” with “two stateless MCP servers, implemented with Server-Sent Events (SSE).”  
**Why it matters:** Validation implies some degree of robustness, transferability, or empirical substantiation. A single-stack feasibility demo does not validate general enterprise deployment claims, especially not across identity systems, network environments, transport variants, and threat scenarios.

### Scope

#### 5. The paper overextends from PoC feasibility to enterprise-scale and spec-compliance claims.
**Evidence:** The Introduction says the Gateway handles authentication and access control “while ensuring spec-compliant deployments.” **Section IX** concludes that it enables “robust, secure, scalable, and spec-compliant AI integrations.” But **Section VII** only demonstrates a PoC with SSE servers, MCP Inspector, and Cloudflare AI Playground.  
**Why it matters:** “Enterprise-scale” and “spec-compliant” are broad claims. The paper does not test scale, does not enumerate the specification conformance surface, and does not examine edge cases. Feasibility of one flow is not evidence for broad compliance or scalability.

#### 6. Alternative solutions are dismissed without evidence.
**Evidence:** **Section VIII** states: “Standard API Gateways lack MCP-specific threat understanding and Public MCP gateway solutions do not yet fully address enterprise self-hosted needs.” No table, benchmark, capability comparison, or cited empirical study is provided to justify this.  
**Why it matters:** This unsupported contrast is central to the paper’s novelty framing. If a standard API gateway plus existing IAM controls would deliver similar outcomes, the paper’s incremental value becomes mostly packaging rather than a decision-relevant advance.

### Math & Logic Errors

#### 7. Threat-model mapping is treated as if it demonstrates mitigation effectiveness.
**Evidence:** In **Section VI** and **Table I**, threats such as “Tool Poisoning,” “Injection Attacks,” and “Threat Detection Failure” are assigned corresponding mitigations like “Threat detection (IDS), Content security policies, Input validation” and “Isolation, Strict input validation, Containerization.”  
**Why it matters:** Mapping a threat to a mitigation is not evidence that the mitigation works in the MCP setting. The logic skips the required empirical step: demonstrating that the specific attack classes are meaningfully reduced in this architecture. This weakens the inferential chain from architecture description to security outcome.

## MISSING EVALUATIONS

1. **Adversarial security benchmark against explicit threat scenarios.**  
   Missing experiment: run scripted attacks corresponding to **Table I** threat classes—DoS, protocol abuse, injection, tool poisoning, identity attacks, exfiltration attempts—and report block rate, bypass rate, and false positives.  
   Claim tested: the abstract’s claim of “robust security” and **Section VI**’s threat-mitigation mapping.  
   Why decision-relevant: practitioners need evidence that listed mitigations actually hold under attack, not just in architecture diagrams.

2. **Baseline comparison with a standard API gateway or direct OAuth-enabled MCP server.**  
   Missing experiment: compare the proposed MCP Gateway against at least (i) direct MCP server with embedded auth and (ii) standard API gateway + IdP integration.  
   Claim tested: **Section I**’s simplification argument and **Section VIII**’s statement that standard API gateways lack MCP-specific threat understanding.  
   Why decision-relevant: without this, a buyer cannot know if the architecture offers meaningful gains over existing infrastructure.

3. **Latency/throughput/overhead measurement.**  
   Missing experiment: measure request latency, auth latency, tunnel overhead, throughput under load, and resource utilization with and without CrowdSec/WAF/middleware.  
   Claim tested: **Section VIII**’s acknowledgment of “performance overhead” and **Section IX**’s claim of scalable integration.  
   Why decision-relevant: a security control that severely hurts agent-tool responsiveness may be unusable in production.

4. **Ablation of individual gateway components.**  
   Missing experiment: remove or vary Pangolin/WireGuard, CrowdSec, forward-auth middleware, and security proxy policies to determine which components contribute to which outcomes.  
   Claim tested: the contribution of the “MCP Gateway” versus off-the-shelf tools in **Section VII**.  
   Why decision-relevant: deployment complexity and maintenance burden depend on which pieces are actually necessary.

5. **Evaluation across enterprise IAM systems and policy regimes.**  
   Missing experiment: validate against common enterprise IdPs and authorization patterns, not just “e.g., GitHub, Google” (**Section VII**).  
   Claim tested: enterprise applicability in the **Abstract**, **Introduction**, and **Section V**.  
   Why decision-relevant: IAM integration is often the deployment blocker.

6. **Reliability/failure-mode testing for tunnel and auth dependencies.**  
   Missing experiment: simulate WireGuard tunnel failure, auth service unavailability, expired tokens, key rotation, and Pangolin upgrade breaks.  
   Claim tested: production suitability of the architecture described in **Sections V and VII**, especially given **Section VIII**’s note that Pangolin is immature.  
   Why decision-relevant: real systems fail in dependency edges, not only nominal paths.

7. **Specification conformance tests.**  
   Missing experiment: an explicit checklist or test suite against the MCP spec features relevant to OAuth 2.1 and discovery.  
   Claim tested: “ensuring spec-compliant deployments” (**Introduction**) and “spec-compliant AI integrations” (**Section IX**).  
   Why decision-relevant: compliance claims need conformance evidence, especially if procurement depends on standards adherence.

## SHARPEST FLAW

The sharpest flaw is that the paper’s central contribution is a **security architecture claim without security evidence**. The abstract says the gateway provides “robust security” and “enabl[es] secure self-hosting without exposing infrastructure,” but the entire evaluation in **Section VIII** is summarized as “Qualitative testing showed the gateway's potential,” with anecdotal checks like blocked unauthenticated requests, rejected invalid tokens, and rate limiting. There are no adversarial experiments, no quantitative attack outcomes, no false-positive/false-negative analysis, no performance measurements, and no comparative baselines. As a result, the paper does not establish that the proposed gateway is more secure, sufficiently secure, or practically deployable beyond a basic proof-of-concept composition of standard tools.

## ACCEPTANCE RECOMMENDATION

**Reject**

**Reasoning:** The paper’s core security and enterprise-readiness claims are supported only by a qualitative PoC in **Sections VII–VIII**, with no quantitative evaluation, no baselines, and no attack validation.

## DATASET & DEPLOYMENT AUDIT

### Datasets

This paper does not use ML datasets in the conventional sense, but it does define evaluation artifacts and test environments that raise audit questions.

- **Scale/distribution mismatch:** The evaluation setup consists of “two stateless MCP servers, implemented with Server-Sent Events (SSE)—one hosted locally and one in the cloud” (**Section VII**). This is a narrow prototype environment and is not shown to represent real enterprise MCP deployments with heterogeneous servers, transports, tenant structures, or workloads.
- **Synthetic/tool-driven evaluation rather than real deployment traffic:** The paper says “We used the Anthropic MCP Inspector [7] as the primary client interface” and “the Cloudflare AI Playground [6] was employed to simulate MCP interactions across the public Internet” (**Section VII**). This indicates the evidence comes from testing tools/simulated interactions rather than production-like enterprise traffic, limiting ecological validity.
- **No label quality / ground-truth model:** Security success is asserted in qualitative terms in **Section VIII** (“invalid Authorization tokens were rejected,” “CrowdSec blocked excessive requests”), but the paper does not define a benchmark or formal ground truth for attacks, false positives, or expected policy outcomes.
- **Potential circularity from self-authored implementation artifact:** The custom gateway component is the author’s own repository, cited as “[10] Ivo Brett, ‘MCPAuth - MCP Gateway for external Authentication and Authorization,’ GitHub repo, 2025” (**References**, used in **Section VII** as the custom-built auth component). This is not necessarily problematic, but it means the evaluation is conducted on the author’s own stack without independent validation.

### Deployment / Productionization

- **Inference-time/runtime dependencies are substantial and multi-component.** The architecture depends on Pangolin, Traefik, Let’s Encrypt, WireGuard, Gerbil, Newt, Badger, CrowdSec, Docker, and a custom auth component (**Section VII**, **Table II**). This increases integration complexity and operational burden.
- **Infrastructure assumptions are strong and under-discussed.** The PoC is deployed on “a hardened public facing Virtual Private Server (VPS) running Ubuntu Linux (Ubuntu 22.04 64 Bit)” (**Section VII**), with secure tunneling and public ingress. The paper does not discuss whether enterprises that forbid such exposure/tunneling models can adopt the design.
- **Latency/throughput concerns are acknowledged but unmeasured.** **Section VIII** explicitly notes “performance overhead from security processes” and tunnel-management complexity, but provides no numbers. This is a material production risk.
- **Versioning / drift sensitivity is real.** The work depends on “the 2025-03-26 MCP specification” (**Section IV**) and on a specific set of tool versions in **Table II**. The paper also emphasizes that MCP’s security requirements are evolving, which implies potential drift in compatibility and required controls over time.
- **Dependency immaturity is directly acknowledged.** **Section VIII** states that “Pangolin… is a relatively new open-source project (less than six months old at the time of writing).” Since Pangolin is central to tunnelling and management, this creates production risk around stability, security review, and long-term maintenance.
- **Failure modes under operational shift are not tested.** The paper mentions “managing keys/tokens,” “tuning threat detection rules,” and “ensuring reliable tunnel management” (**Section VIII**) but does not evaluate token expiry, key rotation, tunnel interruptions, or IDS/WAF misclassification under changing traffic.

## PRODUCTIONIZABILITY SCORECARD

| Dimension                   | Score 1-5 | Evidence from paper                  |
|-----------------------------|-----------|--------------------------------------|
| Reproducibility             | 3         | Exact software versions are listed in **Table II**, but test procedures and full configs are incomplete; evaluation in **Section VIII** is qualitative. |
| Data availability           | 2         | No standard datasets or benchmarks are used; evaluation relies on MCP Inspector and Cloudflare AI Playground in **Section VII**. |
| Compute accessibility       | 4         | The PoC uses a “public facing VPS” on Ubuntu 22.04 in **Section VII**, suggesting modest hardware needs, though no sizing is given. |
| Implementation completeness | 3         | Architecture and components are described in **Sections V–VII**, but the production path depends on many external tools and a custom auth component. |
| Generalization evidence     | 1         | Evidence is limited to two stateless SSE servers in one PoC setup (**Section VII**) with no broader validation. |
| Claim-to-evidence ratio     | 1         | Broad claims in the **Abstract**, **Introduction**, and **Section IX** are supported only by qualitative observations in **Section VIII**. |
| Statistical rigour          | 1         | No quantitative metrics, no repeated trials, no confidence intervals, and no formal evaluation are provided anywhere in **Sections VII–VIII**. |

Overall productionizability: 2.1/5

## POINTERS

- The paper’s main empirical evidence is explicitly only “Qualitative testing” in **Section VIII**, which is insufficient to support the abstract’s “robust security” claim.
- The claim that the gateway “enabl[es] secure self-hosting without exposing infrastructure” in the **Abstract** is not validated by adversarial experiments, penetration tests, or measured attack outcomes in **Sections VII–VIII**.
- The contribution “validated through implementation” in **Section II** overstates what is shown, since **Section VII** presents only a single PoC on Ubuntu 22.04 with two SSE servers.
- The assertion in **Section VIII** that “Standard API Gateways lack MCP-specific threat understanding” is unsupported by any comparative table, experiment, or cited empirical analysis.
- The assertion in **Section VIII** that public MCP gateway solutions “do not yet fully address enterprise self-hosted needs” is likewise unevidenced by side-by-side evaluation.
- The implementation is confounded by heavy reliance on third-party tools—Pangolin, Traefik, WireGuard, CrowdSec, Let’s Encrypt, Gerbil, Newt, Badger—in **Section VII** and **Table II**, so the paper does not isolate the contribution of the proposed gateway design itself.
- The threat-mitigation mappings in **Table I** are descriptive only; no experiment demonstrates that listed mitigations actually reduce “Tool Poisoning,” “Injection Attacks,” or “Data Exfiltration.”
- The paper claims spec compliance in the **Introduction** and **Section IX**, but only one transport/setup is demonstrated: “two stateless MCP servers, implemented with Server-Sent Events (SSE)” in **Section VII**.
- The paper acknowledges “performance overhead from security processes” in **Section VIII** but omits latency, throughput, and resource measurements needed for production decisions.
- The paper acknowledges “complexity of integrating components” in **Section VIII** but provides no deployment-time ablation or complexity comparison against a simpler baseline architecture.
- The forward-auth implementation interacts with identity providers “e.g., GitHub, Google” in **Section VII**, which is not sufficient evidence for enterprise IAM interoperability.
- The use of MCP Inspector and Cloudflare AI Playground for testing in **Section VII** means the evaluation is tool-driven rather than based on representative enterprise traffic.
- The architecture depends on Pangolin, which **Section VIII** says is “less than six months old,” creating a clear maturity and maintenance risk for production adoption.
- The paper does not evaluate reliability under token expiry, key rotation, tunnel disruption, or auth-service failure despite explicitly listing “managing keys/tokens” and “reliable tunnel management” as challenges in **Section VIII**.
- The conclusion’s claim of “secure, scalable, and spec-compliant AI integrations” in **Section IX** is broader than the evidence supplied by the qualitative PoC in **Sections VII–VIII**.