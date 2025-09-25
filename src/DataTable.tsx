import React, { useEffect, useState } from 'react';

interface DataItem {
  [key: string]: any;
}

const DataTable: React.FC = () => {
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20); // You can make this dynamic if needed

  // Declare the fields you want to display and their corresponding header names
  const displayFields = [
    { field: 'chunkCount', header: 'Chunk Count' },
    { field: 'service', header: 'Service' },
    { field: 'name', header: 'Name' },
    { field: 'identifier', header: 'Identifier' },
    { field: 'totalSpace', header: 'Total Space (MB)' },
    { field: 'size', header: 'Size (MB)' },
    { field: 'timestamp', header: 'Timestamp' },
  ]; // Replace with the actual field names and header names you want to display

  // Helper function to format timestamps
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString(); // You can customize the format as needed
  };

  // Helper function to convert bytes to megabytes without decimal precision
  const formatBytesToMB = (bytes: number): string => {
    const megabytes = bytes / (1024 * 1024);
    return Math.floor(megabytes).toString(); // Remove decimal precision
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const offset = (currentPage - 1) * itemsPerPage;
        const response = await fetch(`/arbitrary/hosted/transactions?limit=${itemsPerPage}&offset=${offset}`);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const result: DataItem[] = await response.json();
        setData(result);
      } catch (error) {
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, itemsPerPage]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error instanceof Error ? error.message : 'An unknown error occurred'}</div>;

  return (
    <div>
      {data.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', textAlign: 'center' }}>
          Either you have no QDN data or your data host monitor has not scanned your hosting directories. The scanning often takes over an hour after restart.
        </div>
      ) : (
        <>
          <table style={{ borderCollapse: 'separate', borderSpacing: '30px 0' }}>
            <thead>
            <tr>
              {displayFields.map(({ header }, index) => (
                <th key={index} style={{ textAlign: 'left' }}>{header}</th>
              ))}
            </tr>
            </thead>
            <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                {displayFields.map(({ field }, idx) => (
                  <td key={idx} style={{ textAlign: field === 'timestamp' ? 'left' : 'right' }}>
                    {field === 'timestamp' ? formatTimestamp(item[field]) :
                      field === 'totalSpace' || field === 'size' ? formatBytesToMB(item[field]) :
                        item[field]}
                  </td>
                ))}
              </tr>
            ))}
            </tbody>
          </table>
          <div>
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
              First Page
            </button>
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
              Previous
            </button>
            <span>Page {currentPage}</span>
            <button onClick={() => setCurrentPage(prev => prev + 1)}>
              Next
            </button>
            <span>Items per page: </span>
            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
};

export default DataTable;