import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import PaperPanel from "../components/PaperPanel";

const longAbstract = "A".repeat(360);

test("paper panel truncates long abstracts and can expand them", () => {
  render(
    <PaperPanel
      isOpen
      isLoading={false}
      onClose={() => {}}
      onRecenter={() => {}}
      paper={{
        paper_id: "paper-1",
        title: "Paper 1",
        authors: ["A", "B", "C", "D", "E", "F"],
        citation_count: 30,
        year: 2020,
        venue: "NeurIPS",
        abstract: longAbstract
      }}
    />
  );

  expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument();
  expect(screen.getByText(/A, B, C, D, E \+1 more/)).toBeInTheDocument();
  expect(screen.getByText(/\.\.\./)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Read more" }));
  expect(screen.getByText(longAbstract)).toBeInTheDocument();
});

test("paper panel triggers recenter callback and resolves the DOI link", () => {
  const onRecenter = vi.fn();

  render(
    <PaperPanel
      isOpen
      isLoading={false}
      onClose={() => {}}
      onRecenter={onRecenter}
      paper={{
        paper_id: "paper-2",
        title: "Paper 2",
        authors: ["A"],
        citation_count: 12,
        year: 2022,
        doi: "10.1000/test-doi",
        abstract: "short abstract"
      }}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Use as origin" }));
  expect(onRecenter).toHaveBeenCalledWith("paper-2");
  expect(screen.getByRole("link", { name: "DOI" })).toHaveAttribute("href", "https://doi.org/10.1000/test-doi");
});
