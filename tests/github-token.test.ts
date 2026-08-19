import { describe, expect, it } from "vitest";

const token = process.env.GITHUB_APK_BUILD_TOKEN;
const repo = "sx01365860-tech/sublingo-offline-apk";

describe("GitHub APK build credential", () => {
  const testWithToken = token ? it : it.skip;

  testWithToken("has write access to the target repository", async () => {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    expect(response.ok).toBe(true);
    const repository = (await response.json()) as { permissions?: { push?: boolean } };
    expect(repository.permissions?.push).toBe(true);
  });
});
