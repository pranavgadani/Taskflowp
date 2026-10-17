import React, { useState, useMemo } from "react";
import ConfirmModal from "./ConfirmModal";

export default function DataTable({
  data = [],
  columns = [],
  onView,
  onEdit,
  onDelete,
  renderActions,
  rowKey = "_id",
  emptyText = "No records found",
  pageSize = 10,
  searchPlaceholder = "Search...",
  // Server-side pagination props
  serverSide = false,
  totalRecords = 0,
  serverCurrentPage = 1,
  onPageChange = null,
}) {
  const [search, setSearch] = useState("");
  const [localCurrentPage, setLocalCurrentPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!search) return data;
    const lowerSearch = search.toLowerCase();
    return data.filter((item) => {
      return columns.some((col) => {
        const value = item[col.key];
        if (value === null || value === undefined) return false;

        // Handle strings, numbers, and arrays/objects by their name
        const stringValue = Array.isArray(value)
          ? value.map((v) => v.name || v).join(" ")
          : typeof value === "object"
            ? value.name || ""
            : String(value);

        return stringValue.toLowerCase().includes(lowerSearch);
      });
    });
  }, [data, search, columns]);

  // Paginate filtered data (only for client-side)
  const totalPages = serverSide ? Math.ceil(totalRecords / pageSize) : Math.ceil(filteredData.length / pageSize);

  const paginatedData = useMemo(() => {
    if (serverSide) return data; // Data is already paginated from server
    const start = (localCurrentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, localCurrentPage, pageSize, serverSide, data]);

  // Reset page when search changes
  React.useEffect(() => {
    if (!serverSide) setLocalCurrentPage(1);
  }, [search, serverSide]);

  const handlePageChange = (newPage) => {
    if (serverSide && onPageChange) {
      onPageChange(newPage);
    } else {
      setLocalCurrentPage(newPage);
    }
  };

  const displayCurrentPage = serverSide ? serverCurrentPage : localCurrentPage;
  const displayTotalRecords = serverSide ? totalRecords : filteredData.length;
  // If server-side is on, we don't have all data to filter client-side, so search is disabled
  // unless we fire a search API call (skipping for now)

  const hasActions = Boolean(onView || onEdit || onDelete || renderActions);

  const getRowKey = (row, index) => {
    if (typeof rowKey === "function") return rowKey(row, index);
    return row?.[rowKey] ?? index;
  };

  return (
    <div className="table-container">
      {/* Search Bar & Stats */}
      <div className="table-controls">
        <div className="search-wrapper">
          <div className="search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /></svg>
          </div>
          <input
            type="text"
            className="search-input"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="table-stats">
          Total: <span>{displayTotalRecords}</span> records
        </div>
      </div>

      <div className="table-responsive" style={{ width: "100%", overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={c.key || i} style={{ textAlign: c.align || 'left' }}>{c.header}</th>
              ))}
              {hasActions && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasActions ? 1 : 0)} style={{ padding: 24, color: "#94a3b8", textAlign: "center" }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr key={getRowKey(row, index)}>
                  {columns.map((c, i) => {
                    const value = row?.[c.key];
                    return (
                      <td key={c.key || i} style={{ textAlign: c.align || 'left' }}>
                        {c.render
                          ? c.render(value, row)
                          : Array.isArray(value)
                            ? value.length > 0 ? value.map(v => v.name || v).join(", ") : "-"
                            : typeof value === "object"
                              ? value?.name || "-"
                              : value ?? "-"}
                      </td>
                    );
                  })}

                  {hasActions && (
                    <td>
                      <div className="action-buttons">
                        {renderActions ? (
                          renderActions(row)
                        ) : (
                          <>
                            {onView && (
                              <button
                                className="action-btn view-btn"
                                onClick={() => onView(row)}
                                title="Quick View"
                                style={{
                                  background: "#f1f5f9",
                                  border: "1px solid #cbd5e1",
                                  color: "#475569",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "30px",
                                  height: "30px",
                                  transition: "all 0.2s"
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "#e0e7ff"; e.currentTarget.style.color = "#4338ca"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#475569"; }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                            )}
                            {onEdit && (
                              <button
                                className="action-btn"
                                onClick={() => onEdit(row)}
                                title="Edit"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                              </button>
                            )}
                            {onDelete && (
                              <button
                                className="action-btn delete"
                                onClick={() => setDeleteId(row?._id)}
                                title="Delete"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <div className="table-stats">
            {((displayCurrentPage - 1) * pageSize) + 1} - {Math.min(displayCurrentPage * pageSize, displayTotalRecords)} of <span>{displayTotalRecords}</span> records
          </div>
          <div className="pagination-buttons">
            <button
              className="page-btn"
              disabled={displayCurrentPage === 1}
              onClick={() => handlePageChange(displayCurrentPage - 1)}
            >
              PREV
            </button>

            {[...Array(totalPages)].map((_, i) => {
              const pageNum = i + 1;
              if (pageNum === 1 || pageNum === totalPages || (pageNum >= displayCurrentPage - 1 && pageNum <= displayCurrentPage + 1)) {
                return (
                  <button
                    key={pageNum}
                    className={`page-btn ${displayCurrentPage === pageNum ? 'active' : ''}`}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              } else if (pageNum === displayCurrentPage - 2 || pageNum === displayCurrentPage + 2) {
                return <span key={pageNum} style={{ padding: '0 8px', color: '#94a3b8' }}>...</span>;
              }
              return null;
            })}

            <button
              className="page-btn"
              disabled={displayCurrentPage === totalPages}
              onClick={() => handlePageChange(displayCurrentPage + 1)}
            >
              NEXT
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        show={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          onDelete(deleteId);
          setDeleteId(null);
        }}
        title="Delete Confirmation"
        message="Are you sure you want to delete this record?"
      />
    </div>
  );
}