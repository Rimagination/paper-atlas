import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useGraph } from "../hooks/useGraph";
import { getGraph, getPaperDetail, searchPapers } from "../api/client";

vi.mock("../api/client", () => ({
  getGraph: vi.fn(),
  getPaperDetail: vi.fn(),
  searchPapers: vi.fn()
}));

function Harness() {
  const graph = useGraph();

  return (
    <div>
      <input
        aria-label="query"
        value={graph.query}
        onChange={(event) => graph.setQuery(event.target.value)}
      />
      <div data-testid="status">{graph.status}</div>
      <div data-testid="error">{graph.error || graph.searchError}</div>
      <div data-testid="selected">{graph.selectedPaper?.title || ""}</div>
      {graph.searchResults.map((paper) => (
        <button
          key={paper.paper_id}
          type="button"
          onClick={() => graph.loadGraph(paper.paper_id, { title: paper.title })}
        >
          {paper.title}
        </button>
      ))}
      <button type="button" onClick={() => graph.loadGraph("seed", { title: "Seed" })}>
        load-seed
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

test("search uses a 300ms debounce", async () => {
  searchPapers.mockResolvedValue([
    { paper_id: "paper-1", title: "Attention Is All You Need", authors: [], citation_count: 10 }
  ]);

  render(<Harness />);
  fireEvent.change(screen.getByLabelText("query"), { target: { value: "attention" } });

  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 200));
  });
  expect(searchPapers).not.toHaveBeenCalled();

  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
  });
  await waitFor(() => expect(searchPapers).toHaveBeenCalledWith("attention", expect.anything()));
});

test("selecting a result loads the graph and hydrates paper detail", async () => {
  searchPapers.mockResolvedValue([
    { paper_id: "seed", title: "Seed Paper", authors: ["Author"], citation_count: 20 }
  ]);
  getGraph.mockResolvedValue({
    seed_paper_id: "seed",
    nodes: [
      {
        id: "seed",
        title: "Seed Paper",
        authors: ["Author"],
        citation_count: 20,
        year: 2020,
        abstract: "short abstract",
        is_seed: true
      }
    ],
    edges: []
  });
  getPaperDetail.mockResolvedValue({
    paper_id: "seed",
    title: "Seed Paper Detail",
    authors: ["Author"],
    citation_count: 20,
    year: 2020,
    venue: "ICML",
    abstract: "short abstract"
  });

  render(<Harness />);
  fireEvent.change(screen.getByLabelText("query"), { target: { value: "seed paper" } });

  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 320));
  });

  await waitFor(() => screen.getByRole("button", { name: "Seed Paper" }));
  fireEvent.click(screen.getByRole("button", { name: "Seed Paper" }));

  await waitFor(() => expect(getGraph).toHaveBeenCalledWith("seed", expect.anything()));
  await waitFor(() => expect(getPaperDetail).toHaveBeenCalledWith("seed", expect.anything()));
  await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("Seed Paper Detail"));
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
});

test("graph request failures move the hook into error state", async () => {
  getGraph.mockRejectedValue(new Error("boom"));

  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "load-seed" }));

  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
  expect(screen.getByTestId("error")).toHaveTextContent("boom");
});
