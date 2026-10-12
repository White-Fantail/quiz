import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperation,operations} from "../src/modules/platform/contracts.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const uuid="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const startAt="2026-10-12T00:00:00.000Z",endAt="2026-10-20T00:00:00.000Z";

test("only trusted ADMIN APIs can schedule, audit, pause and remove editorial picks",()=>{
 const good={targetType:"PACK",targetId:uuid,locale:"ko",lane:"GENERAL",
   placement:"HERO",headline:"Korean history",startAt,endAt,confirm:true};
 assert.equal(parseOperation("admin_feature_create",good).priority,0);
 assert.throws(()=>parseOperation("admin_feature_create",{...good,confirm:false}));
 assert.throws(()=>parseOperation("admin_feature_create",{...good,targetType:"INVALID"}));
 assert.throws(()=>parseOperation("admin_feature_create",{...good,lane:"TEENS"}));
 assert.equal(operations.admin_feature_create.public,false);
 assert.equal(operations.admin_feature_remove.public,false);
 assert.equal(operations.admin_pack_safety_review.public,false);
 assert.equal(operations.editorial_features.public,true);
 assert.throws(()=>parseOperation("editorial_features",{lane:"KIDS"}));
 const code=read("src/modules/platform/editorial.ts");
 for(const marker of ["admin_required","safeFeatureTarget","editorial.create","editorial.update",
   "editorial.remove","startAt:{lte:now}","endAt:{gt:now}","Editor's Pick"])
    assert.ok(code.includes(marker),"Missing editorial control: "+marker);
 assert.match(code,/p\.status==="ACTIVE"/);
 assert.match(code,/safePack\(pack\.id,pack\.sourceLocale,"KIDS"/);
});

test("editorial placement is FK-exclusive, windowed, audited and separate from ranked scores",()=>{
 const schema=read("../../prisma/schema.prisma");
 const sql=read("../../prisma/migrations/20261013030000_editorial_and_kids_packs/migration.sql");
 assert.match(schema,/model EditorialFeature/);
 assert.match(sql,/EditorialFeature_target_check/);
 assert.match(sql,/EditorialFeature_valid_check/);
 assert.match(sql,/"startAt"<"endAt"/);
 assert.match(sql,/QuizPack_kidsApproval_check/);
 const ranks=read("src/modules/platform/discovery.ts");
 assert.doesNotMatch(ranks,/editorialFeature\.findMany|editorialFeaturesList/);
 const page=read("app/(platform)/discover/page.tsx");
 assert.match(page,/EditorialHighlights/);
 assert.match(read("app/(platform)/discover/editorial-highlights.tsx"),/Editor\x27s Pick/);
 assert.match(read("app/admin/page.tsx"),/\/admin\/features/);
 assert.match(read("app/admin/features/page.tsx"),/actor\.role!=="ADMIN"/);
 assert.match(read("app/admin/features/feature-console.tsx"),/window\.confirm/);
});

test("whole-pack safety approval is distinct from author publication and resets on editing",()=>{
 const schema=read("../../prisma/schema.prisma");
 assert.match(schema,/kidsEligible\s+Boolean\s+@default\(false\)/);
 const social=read("src/modules/platform/social.ts");
 assert.match(social,/currentVersion:\\{increment:1\\}[\\s\\S]{0,180}safetyStatus:old\\.safetyStatus==="RESTRICTED"\\?"RESTRICTED":"PENDING",kidsEligible:false/);
 assert.match(social,/restricted_pack/);
 assert.match(social,/publication:"PUBLISHED",safetyStatus:"PENDING",kidsEligible:false/);
 const safety=read("src/modules/platform/feature-eligibility.ts");
 assert.match(safety,/sourceLocale!==locale/);
 assert.match(safety,/\["ORIGINAL","LEGACY"\]/);
 assert.match(safety,/approvedMedia\(revisions\)/);
 assert.match(safety,/ageEligible\(q\.recommendedAudience/);
 const editorial=read("src/modules/platform/editorial.ts");
 assert.match(editorial,/pack\.safetyStatus==="RESTRICTED"/);
 assert.match(editorial,/action:"pack\.kids_safety\.review"/);
 assert.match(read("app/admin/packs-review/page.tsx"),/actor\.role!=="ADMIN"/);
});

test("native Kids pack flow is device-bound and fail-closed under time and content revocations",()=>{
 const route=read("app/api/kids/native/play/route.ts");
 assert.match(route,/action:z\.literal\("pack_start"\)/);
 assert.match(route,/startKidPack\(kid,data\.packId\)/);
 assert.match(route,/nativeKidFromHeaders\(request\.headers\)/);
 assert.match(route,/await requirePlayable\(kid\)/);
 const catalog=read("app/api/kids/native/route.ts");
 assert.match(catalog,/view:z\.enum\(\["session","catalog","packs","features"\]\)/);
 assert.match(catalog,/kidPacksCatalog\(kid/);
 assert.match(catalog,/kidFeatures\(kid\)/);
 const packs=read("src/modules/kids/packs.ts");
 assert.match(packs,/safePack\(packId,locale,"KIDS"/);
 assert.match(packs,/kidOwnership:\{create:\{profileId:kid\.profileId,deviceId:kid\.id\}\}/);
 assert.match(packs,/isolationLevel:"Serializable"/);
 assert.match(packs,/orderPackQuestions/);
 const game=read("src/modules/kids/game.ts");
 assert.match(game,/await safePack\(packRun\.packId/);
 assert.match(game,/await safePack\(reference\.packId/);
 assert.match(game,/childActor\(kid\)/);
 const device=read("../kids/app/game.tsx");
 assert.match(device,/kidsApi!\.startPack\(token,params\.packId\)/);
 assert.match(device,/SecureStore\.setItemAsync/);
 assert.match(device,/mode:"PACK"/);
});

test("Kids UI stays native, translatable, with isolated sample web preview",()=>{
 const navigation=read("../kids/app/(tabs)/_layout.tsx");
 assert.match(navigation,/name:"packs",label:"kids\.nav\.packs"/);
 const ui=read("../kids/app/(tabs)/packs.tsx");
 assert.match(ui,/kidsApi\.packs\(token/);
 assert.match(ui,/kidsApi\.features\(token\)/);
 assert.match(ui,/time\.status!=="allowed"/);
 assert.doesNotMatch(ui,/reviewUpsert|ratingAccess|leaderboard/);
 const web=read("../kids/app/(tabs)/packs.web.tsx");
 assert.match(web,/Preview/);assert.doesNotMatch(web,/kidsApi|Authorization|SecureStore/);
 const words=read("../../packages/i18n/src/kids.ts");
 assert.match(words,/"kids\.nav\.packs": "Quiz packs"/);
 assert.match(words,/"kids\.nav\.packs": "퀴즈팩"/);
 for(const op of ["admin_feature_create","admin_feature_list","admin_feature_candidates",
   "admin_feature_update","admin_feature_remove","admin_pack_safety_list","admin_pack_safety_review",
   "editorial_features"])assert.match(read("app/api/v1/[...segments]/route.ts"),
     new RegExp('op:\\s*"'+op+'"'),op);
});
