import { describe, expect, it } from "vitest";
import { kgNodeColor, mapRoomGraphToReagraph } from "./knowledge-graph-client";

describe("knowledge-graph-client", () => {
  it("maps API nodes and edges to reagraph shape", () => {
    const { nodes, edges } = mapRoomGraphToReagraph({
      nodes: [
        { id: "n1", nodeType: "task", label: "Ship v2", confidence: 0.9 },
        { id: "n2", nodeType: "decision", label: "Go live", confidence: 0.8 },
      ],
      edges: [
        {
          id: "e1",
          sourceNodeId: "n2",
          targetNodeId: "n1",
          edgeType: "depends_on",
        },
      ],
    });

    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.fill).toBe(kgNodeColor("task"));
    expect(nodes[0]?.cluster).toBe("task");
    expect(edges).toHaveLength(1);
    expect(edges[0]?.source).toBe("n2");
    expect(edges[0]?.target).toBe("n1");
    expect(edges[0]?.label).toBe("depends on");
  });

  it("drops edges with missing endpoints", () => {
    const { edges } = mapRoomGraphToReagraph({
      nodes: [{ id: "n1", nodeType: "concept", label: "A" }],
      edges: [
        {
          id: "e1",
          sourceNodeId: "n1",
          targetNodeId: "missing",
          edgeType: "references",
        },
      ],
    });
    expect(edges).toHaveLength(0);
  });
});
