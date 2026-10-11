# QuizDip — authoring via Studio and ChatGPT/MCP

The platform supports **two** authoring paths, built on one schema, ownership model, audit policy and service layer.

## ChatGPT + Remote MCP

Example: “초등학생을 위한 공룡 맞히기 퀴즈 10개 만들어줘. 사진과 소리 단서를 쓰고 뒤로 갈수록 쉬워지게 해줘.”

1. Look up supported game formats, clue/media types and required fields.
2. Generate Question, Answer (including acceptable aliases), ordered Clues, and media ideas or validated references.
3. Infer initial category, difficulty and recommended audience; respect the creator's desired audience and optional corrections.
4. Offer a readable/playable preview; let the creator rewrite, reorder, replace or delete a clue and adjust answers.
5. Authenticate the **actual owner** using MCP user OAuth. Require user confirmation before publishing or significant/bulk modifications.
6. Persist via shared service operations, not MCP-only database writes. Display publication and Kids eligibility separately.
7. Allow later retrieval, pack creation, edits, aggregate quality feedback and AI revision proposals.

## Browser Studio

Support direct manual creation even when AI is unavailable. Minimize mandatory configuration. Put age-intent, categorization, advanced reveal settings and media options behind optional controls. Editing, preview, revision history, publication and creator metrics should remain easy and transparent.

## Engineering obligations

Studio, REST and MCP must use identical domain checks for ownership, publishing, Kids gates, versioning and quotas. This repository also requires **product-wide REST/MCP operation parity** (not only authoring tools), or a documented safety exception. New operations update service, validation, REST, MCP, tests and docs together. An AI-generated instruction or uploaded quiz is **untrusted input**, never a privileged command. Do not bulk-publish on an AI agent's initiative or claim a saved/approved result that the server did not confirm.

See [product principles](product-principles.md), [content policy](content-policy.md), [API/MCP](api-mcp.md) and [auth](auth-sso-mcp.md).
