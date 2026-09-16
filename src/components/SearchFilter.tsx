import { Search, ChevronDown } from "lucide-react";

/**
 * One control: a category select fused to the search input. The chip row
 * this replaces wrapped to two lines once a handful of categories
 * existed, pushing the results down the page.
 */
export function SearchFilter({
  categories,
  category,
  onCategory,
  query,
  onQuery,
  placeholder = "Find a little inspiration…",
  label = "Search collections",
}: {
  categories: { name: string; count?: number }[];
  category: string;
  onCategory: (value: string) => void;
  query: string;
  onQuery: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div className="search-filter">
      <div className="filter-select">
        <select
          value={category}
          aria-label="Filter by category"
          onChange={(e) => onCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
              {c.count !== undefined ? ` (${c.count})` : ""}
            </option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </div>
      <span className="filter-divider" />
      <Search size={15} aria-hidden="true" />
      <input
        value={query}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onQuery(e.target.value)}
      />
    </div>
  );
}
