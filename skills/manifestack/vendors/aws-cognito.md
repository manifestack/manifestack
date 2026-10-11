---
# generated, edit catalog/vendors/aws-cognito.md (then run: node tools/sync.mjs)
schema: 1
id: aws-cognito
name: Amazon Cognito
family: aws
roles: [auth]
detect:
  packages: ["@aws-sdk/client-cognito-identity-provider", "@aws-sdk/client-cognito-identity", "amazon-cognito-identity-js", "aws-jwt-verify", "@aws-amplify/auth"]
  pypi: ["pycognito", "fastapi-cognito", "cognitojwt", "mypy-boto3-cognito-idp"]
  go: ["github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider", "github.com/aws/aws-sdk-go-v2/service/cognitoidentity", "github.com/aws/aws-sdk-go/service/cognitoidentityprovider"]
  imports: ["@aws-sdk/client-cognito-identity-provider", "@aws-sdk/client-cognito-identity", "amazon-cognito-identity-js", "aws-jwt-verify", "@aws-amplify/auth", "aws-amplify/auth"]
  env_prefixes: ["COGNITO_", "AUTH_COGNITO_"]
  config_files: []
  service_signals: ["client('cognito-idp'", "client(\"cognito-idp\"", "client('cognito-identity'", "client(\"cognito-identity\"", "aws_cognito", "AWS::Cognito::", "aws-cdk-lib/aws-cognito", "CognitoIdentityServiceProvider", "cognito-idp:", "cognito-idp.", "amazoncognito.com", "providers/cognito", "aws_cognito as", "aws.cognito."]
pages:
  pricing: https://aws.amazon.com/cognito/pricing/
  feature_plans: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-sign-in-feature-plans.html
  quotas: https://docs.aws.amazon.com/cognito/latest/developerguide/quotas.html
  costs: https://docs.aws.amazon.com/cognito/latest/developerguide/tracking-cost.html
  email: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html
  sms: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-sms-settings.html
  threat_protection: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-threat-protection.html
read:
  - feature plans (Lite, Essentials, Plus), which is the default for new user pools, and what each adds (passkeys and passwordless, managed login, threat protection)
  - price per MAU for each plan, which plans have a free MAU allowance (Plus has none), and the separate price and smaller free allowance for SAML or OIDC federated MAUs
  - what counts a user as active in a month (sign-in, token refresh, admin reads such as AdminGetUser) and that a user is billed at the highest plan active that month
  - legacy terms for pools from before the plan change (advanced security features add-on)
  - M2M token requests (client credentials), billed per request with no free tier
  - add-ons for multi-Region replication and purchased API request-rate capacity
  - request-rate quotas per category (UserAuthentication, UserCreation and others) per Region, and what happens at the limit (throttling)
  - default email sending limit and that production needs SES; SMS through End User Messaging or SNS is billed there
usage_questions:
  - metric: mau
    ask: Monthly active users last month, split by direct and federated sign-in?
    where: Billing and Cost Management → Cost Explorer → Service Cognito, group by Usage type
  - metric: feature_plan
    ask: Which feature plan does each production user pool use?
    where: Cognito console → User pools → pool → Settings → Feature plans
  - metric: m2m_tokens
    ask: M2M token requests per month, by app client?
    where: Service Quotas → Amazon Cognito → Rate of ClientAuthentication requests (Utilization); bill line items per app client
  - metric: email_sms
    ask: Does the pool send email through Cognito's default or SES, and is SMS used for MFA or verification?
    where: Cognito console → User pools → pool → Authentication methods → Email configuration and SMS configuration
mcp:
  official: false
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - pick the cheapest plan whose features the app uses; do not leave a pool on Plus for one feature
  - do not touch inactive users in scripts (use ListUsers, not AdminGetUser) so they are not billed
  - cache M2M access tokens and request new ones only near expiry
  - switch email to SES before launch; prefer email or TOTP MFA to SMS, and set an SMS spend limit
  - link federated users to local profiles where they sign in both ways
verified: 2026-10-11
---

- Amplify Auth is Cognito: `@aws-amplify/auth` and the `aws-amplify/auth` import find this map; the rest of Amplify belongs to the Amplify map. Auth.js and NextAuth with the Cognito provider are found by `providers/cognito`, `COGNITO_*` and the `cognito-idp.` issuer.
- Identity pools (federated identities) are free; their AWS credentials bill the services they call.
- The pricing page fills prices in with JavaScript by Region; read it in a browser or the Pricing Calculator.
- SMS for MFA and sign-up is an SMS pumping target: a Cost Risk until SMS is limited (the SNS map covers SMS fees and spend limits).
- Cognito with Clerk, Auth0, Supabase Auth, Firebase Auth or WorkOS is Overlap unless one is a migration source.
