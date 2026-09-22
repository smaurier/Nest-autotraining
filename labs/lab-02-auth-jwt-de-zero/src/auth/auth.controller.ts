// auth.controller.ts — PAGE BLANCHE. Routes fines, tout délégué au service.
// Export attendu : AuthController, avec :
//   POST /auth/register  → body RegisterDto → 201, { id, email } (jamais le hash)
//   POST /auth/login     → body LoginDto → 200, { accessToken }
//   GET  /auth/me        → protégée par JwtAuthGuard → 200, le payload du token
//                           (accède à `request.user` via @Req())
export {};
