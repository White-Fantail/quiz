import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("native child play data is private and deletes with its owning profile",()=>{
  const schema=file("../../prisma/schema.prisma"),sql=file("../../prisma/migrations/20261012200000_kids_native_play/migration.sql");
  for(const model of ["KidPlayRun","KidPlaySingle"]){
    assert.match(schema,new RegExp("model "+model+" \\{"));
    assert.ok(sql.includes('CREATE TABLE "'+model+'"'));
  }
  assert.match(sql,/REFERENCES "KidProfile"\("id"\) ON DELETE CASCADE/);
  assert.match(schema,/kidOwnership\s+KidPlayRun\?/);
  assert.match(schema,/kidSingle\s+KidPlaySingle\?/);
});
test("native child endpoints only allow game actions and authenticated device",()=>{
  const route=file("app/api/kids/native/play/route.ts");
  assert.match(route,/nativeKidFromHeaders\(request.headers\)/);
  assert.match(route,/z\.literal\(\"RANDOM_FIVE\"\)/);
  assert.match(route,/run_start/);
  assert.match(route,/single_start/);
  assert.match(route,/single_current/);
  assert.match(route,/play_media|kidMedia/);
  assert.match(route,/Cache-Control/);
  assert.doesNotMatch(route,/actorFor\(/);
  assert.doesNotMatch(route,/ADMIN|studio|review_upsert|ranking_optin/);
});
test("game starts force Kids lane and the child's guardian-pinned locale",()=>{
  const game=file("src/modules/kids/game.ts");
  assert.match(game,/lane:"KIDS",locale:kid.profile.locale/);
  assert.match(game,/kids:true,locale/);
  assert.match(game,/playableQuizWhere\(locale,"KIDS"\)/);
  assert.match(game,/avoidQuizIds:avoid/);
  assert.match(game,/profileId:kid.profileId,deviceId:kid.id/);
  assert.match(game,/approvedOrigins/);
  assert.match(game,/revision.localization.publishedVersion!==entry.revision.version/);
  assert.match(game,/mediaAsset.count/);
  assert.match(game,/moderationStatus:"APPROVED"/);
  assert.match(game,/entry.quiz.kidsReviewStatus!=="APPROVED"/);
  assert.match(game,/kidsReviewStatus:"APPROVED"/);
  assert.doesNotMatch(game,/entry.quiz.safetyStatus!=="APPROVED"/);
});
test("ordinary guest REST play and run capabilities cannot access child-owned sessions",()=>{
  const play=file("src/modules/platform/play.ts"),runs=file("src/modules/platform/runs.ts");
  assert.match(play,/kidPlayRun.findUnique/);
  assert.match(play,/kidPlaySingle.findUnique/);
  assert.match(play,/actor\?\.childScope\?\.profileId/);
  assert.match(runs,/kidPlayRun.findUnique/);
  assert.match(runs,/actor\?\.childScope\?\.deviceId/);
  const game=file("src/modules/kids/game.ts");
  assert.match(game,/childActor\(kid\)/);
  assert.match(game,/runCurrent\(\{runId/);
  assert.match(game,/signedPlayMedia\(/);
});
test("clues and guesses reuse server grading, with private non-public child rewards",()=>{
  const game=file("src/modules/kids/game.ts");
  assert.match(game,/playClue\(\{sessionId,sessionToken\},childActor\(kid\)\)/);
  assert.match(game,/playGuess\(\{sessionId,sessionToken,guess\},childActor\(kid\)\)/);
  assert.match(game,/kidTreasures/);
  assert.match(game,/score:true,finishedAt:true/);
  assert.doesNotMatch(game,/leaderboardEligible:true|leaderboardOptIn:true/);
});
test("Expo native player renders local clues and approved media without per-guess server roundtrips",()=>{
  const screen=file("../kids/app/game.tsx"),clue=file("../kids/src/components/KidClueView.tsx");
  assert.match(screen,/revealLocalClue/);
  assert.match(screen,/guessLocalAnswer/);
  assert.match(screen,/kidsApi\.runBundle/);
  assert.match(screen,/kidsApi\.runSync/);
  assert.match(screen,/SecureStore\.setItemAsync/);
  assert.match(screen,/native\.play\.notEnough/);
  assert.match(clue,/expo-image/);
  assert.match(clue,/expo-audio/);
  assert.match(clue,/expo-video/);
  assert.match(clue,/SafeKidMedia/);
  assert.doesNotMatch(screen,/DATABASE_URL|BETTER_AUTH_SECRET/);
});
