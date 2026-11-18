export type MembershipFilter = "Joined" | "Not-Joined";

export type TeamsSort =
    | "name-asc"
    | "name-desc"
    | "members-asc"
    | "members-desc"
    | "projects-asc"
    | "projects-desc";

export type TeamsOrdering = "name" | "members" | "projects";

export type TeamDisplayPropertyKey =
    | "membership"
    | "owners"
    | "projects"
    | "cycle"
    | "created"
    | "updated"
    | "members";

export type TeamDisplayProperties = Record<
    TeamDisplayPropertyKey,
    boolean
>;

export const TEAM_DISPLAY_PROPERTIES: {
    key: TeamDisplayPropertyKey;
    label: string;
}[] = [
        { key: "membership", label: "Membership" },
        { key: "owners", label: "Owners" },
        { key: "projects", label: "Projects" },
        { key: "cycle", label: "Cycle" },
        { key: "created", label: "Created" },
        { key: "updated", label: "Updated" },
        { key: "members", label: "Members" },
    ];

export const DEFAULT_TEAM_DISPLAY_PROPERTIES: TeamDisplayProperties = {
    membership: true,
    owners: false,
    projects: true,
    cycle: false,
    created: false,
    updated: false,
    members: true,
};