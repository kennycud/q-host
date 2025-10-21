import React, { useEffect, useState } from 'react';

interface DataItem {
  [key: string]: any;
}

const DataTable: React.FC = () => {
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20); // You can make this dynamic if needed
  const [apiRequest, setApiRequest] = useState<DataItem | null>(null); // State for API request data
  const [apiResponse, setApiResponse] = useState<any>(null); // State for API response
  const [metadataResponse, setMetadataResponse] = useState<any>(null); // State for metadata response
  const [selectedRow, setSelectedRow] = useState<DataItem | null>(null); // State for selected row
  const [isLoadingResponse, setIsLoadingResponse] = useState(false); // State for loading spinner
  const [searchName, setSearchName] = useState(''); // State for search input
  const [count, setCount] = useState<number | null>(null); // State for count
  const [totalSpace, setTotalSpace] = useState<number | null>(null); // State for totalSpace
  const [statusError, setStatusError] = useState<string | null>(null); // State for status error
  const [metadataError, setMetadataError] = useState<string | null>(null); // State for metadata error

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

  // Helper function to convert bytes to gigabytes and round to the nearest tenth
  const formatBytesToGB = (bytes: number): string => {
    const gigabytes = bytes / (1024 * 1024 * 1024);
    return gigabytes.toFixed(1); // Round to the nearest tenth
  };

  // Helper function to format count with commas
  const formatCount = (count: number): string => {
    return count.toLocaleString();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const offset = (currentPage - 1) * itemsPerPage;
        let url = `/arbitrary/hosted/transactions?limit=${itemsPerPage}&offset=${offset}`;
        if (searchName) {
          url += `&name=${searchName}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const result: { items: DataItem[], count: number, totalSpace: number } = await response.json();
        setData(result.items);
        setCount(result.count);
        setTotalSpace(result.totalSpace);
        // Reset selected row and bottom panel on page or name change
        setSelectedRow(null);
        setApiRequest(null);
        setApiResponse(null);
        setMetadataResponse(null);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, itemsPerPage, searchName]);

  // Function to handle row click and fetch API data
  const handleRowClick = async (rowData: DataItem) => {
    if (isLoadingResponse) return; // Prevent new row selections while loading
    setSelectedRow(rowData);
    setApiRequest(rowData); // Store the API request data
    setApiResponse(null); // Clear the previous API response
    setMetadataResponse(null); // Clear the previous metadata response
    setIsLoadingResponse(true);
    setStatusError(null); // Clear previous status error
    setMetadataError(null); // Clear previous metadata error
    try {
      // First, make a fetch to /arbitrary/resources/searchsimple
      let searchUrl = `/arbitrary/resources/searchsimple?name=${rowData.name}&service=${rowData.service}&limit=1`;
      if (rowData.identifier) {
        searchUrl += `&identifier=${rowData.identifier}`;
      }
      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) {
        throw new Error('Network response was not ok for search');
      }
      const searchResult = await searchResponse.json();

      // Handle the search result as an array of objects
      const firstObject = searchResult.length > 0 ? searchResult[0] : null;
      const updatedTimestamp = firstObject ? firstObject.updated : undefined;

      // Check if the updated field is defined and does not match the timestamp
      if (updatedTimestamp && updatedTimestamp !== rowData.timestamp) {
        // Display a message in the status panel
        setApiResponse({
          updatedMessage: `The artifact selected is outdated and stale. The artifact was updated on ${formatTimestamp(updatedTimestamp)}.`
        });
      } else {
        // Proceed to call the status API
        let requestUrl;
        if (rowData.identifier) {
          requestUrl = `/arbitrary/resource/status/${rowData.service}/${rowData.name}/${rowData.identifier}`;
        } else {
          requestUrl = `/arbitrary/resource/status/${rowData.service}/${rowData.name}`;
        }
        const response = await fetch(requestUrl);
        if (!response.ok) {
          throw new Error('Network response was not ok for status');
        }
        const result = await response.json();
        setApiResponse(result);

        // Fetch metadata only if identifier is present
        if (rowData.identifier) {
          const metadataUrl = `/arbitrary/metadata/${rowData.service}/${rowData.name}/${rowData.identifier}`;
          const metadataResponse = await fetch(metadataUrl);
          if (!metadataResponse.ok) {
            throw new Error('Network response was not ok for metadata');
          }
          const metadataResult = await metadataResponse.json();
          setMetadataResponse(metadataResult);
        }
      }
    } catch (error: any) {
      if (error.message.includes('status')) {
        setStatusError(error.message);
      } else if (error.message.includes('metadata')) {
        setMetadataError(error.message);
      } else {
        setError(error.message);
      }
    } finally {
      setIsLoadingResponse(false);
    }
  };

  // Event handler for the Delete button
  const handleDelete = () => {
    if (apiRequest) {
      setIsLoadingResponse(true);

      qortalRequest({
        action: "DELETE_HOSTED_DATA",
        hostedData: [
          {
            identifier: apiRequest.identifier,
            name: apiRequest.name,
            service: apiRequest.service
          }
        ]
      }).then(() => {
        // Refresh the bottom panel with the selected row data
        setApiRequest(apiRequest);
        setApiResponse(null); // Clear the previous API response

        const requestUrl = `/arbitrary/resource/status/${apiRequest.service}/${apiRequest.name}/${apiRequest.identifier}`;
        fetch(requestUrl)
          .then(response => response.json())
          .then(result => {
            setApiResponse(result);
          })
          .catch(error => {
            setStatusError(error.message);
          });
      }).finally(() => {
        setIsLoadingResponse(false);
      });
    } else {
      console.log('No data available');
    }
  };

  // Event handler for the Clear button
  const handleClear = () => {
    setSearchName('');
  };

  useEffect(() => {
    // Go to the first page when the search name changes
    if (searchName) {
      setCurrentPage(1);
    }
  }, [searchName]);

  if (loading) return <div>Loading...</div>;
  if (error) return (
    <div style={{ border: '1px solid red', padding: '20px', margin: '20px', backgroundColor: '#f8d7da', color: 'red' }}>
      <strong>Error:</strong> {error}
    </div>
  );

  // Fields to display from the API request data with more readable names and formatting
  const requestFields = [
    { field: 'name', label: 'Name' },
    { field: 'service', label: 'Service' },
    { field: 'identifier', label: 'Identifier' },
    { field: 'totalSpace', label: 'Total Space (MB)', format: formatBytesToMB },
    { field: 'timestamp', label: 'Timestamp', format: formatTimestamp },
    { field: 'signature', label: 'Signature' },
    { field: 'creatorAddress', label: 'Creator Address' },
    { field: 'size', label: 'Size (MB)', format: formatBytesToMB },
  ];

  // Fields to display from the API response with more readable names
  const responseFields = [
    { field: 'title', label: 'Title' },
    { field: 'description', label: 'Description' },
    { field: 'localChunkCount', label: 'Local Chunk Count' },
    { field: 'totalChunkCount', label: 'Total Chunk Count' },
    { field: 'percentLoaded', label: 'Percent Loaded' },
  ];

  // Fields to display from the metadata response with more readable names
  const metadataFields = [
    { field: 'title', label: 'Title' },
    { field: 'description', label: 'Description' },
  ];

  // Calculate total number of pages
  const totalPages = Math.ceil((count || 0) / itemsPerPage);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        {(searchName || count !== 0) && (
          <div>
            <input
              type="text"
              placeholder="Search by name"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              style={{ padding: '10px', width: '300px' }}
            />
            <button onClick={handleClear} style={{ marginLeft: '10px', padding: '10px' }}>
              Clear
            </button>
          </div>
        )}
        {(searchName || count !== 0) && (
          <div>
            <p>Count: {count !== null ? formatCount(count) : 'N/A'}</p>
            <p>Total Space: {totalSpace !== null ? formatBytesToGB(totalSpace) : 'N/A'} GB</p>
          </div>
        )}
      </div>
      {(searchName || count !== 0) && (
        <p style={{ color: 'gray', fontSize: '12px', marginBottom: '10px' }}>This is delayed data.</p>
      )}
      {data.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', textAlign: 'center' }}>
          {searchName ? (
            <p>No data found for the name "{searchName}". Please try a different name.</p>
          ) : (
            <p>Either you have no QDN data, you have not enabled host monitoring on your node or your data host monitor has not scanned your hosting directories. The scanning often takes over an hour after restart.</p>
          )}
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
            {data.map((item, index) => {
              const isSelected = selectedRow && JSON.stringify(selectedRow) === JSON.stringify(item);
              const originalBgColor = isSelected ? '#000' : '#f9f9f9';
              const originalTextColor = isSelected ? '#fff' : '#333';

              return (
                <tr
                  key={index}
                  onClick={() => handleRowClick(item)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: originalTextColor,
                    color: originalBgColor,
                    pointerEvents: isLoadingResponse ? 'none' : 'auto', // Disable clicks while loading
                  }}
                >
                  {displayFields.map(({ field }, idx) => (
                    <td key={idx} style={{ textAlign: field === 'timestamp' ? 'left' : 'right' }}>
                      {field === 'timestamp' ? formatTimestamp(item[field]) :
                        field === 'totalSpace' || field === 'size' ? formatBytesToMB(item[field]) :
                          item[field]}
                    </td>
                  ))}
                </tr>
              );
            })}
            </tbody>
          </table>
          <div>
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
              First Page
            </button>
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
              Next
            </button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
              Last Page
            </button>
            <span>Items per page: </span>
            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          {isLoadingResponse ? (
            <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px', textAlign: 'center' }}>
              <p>Loading...</p>
            </div>
          ) : (
            <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {selectedRow ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ flex: 1, marginRight: '20px' }}>
                      {statusError ? (
                        <div style={{ border: '1px solid red', padding: '20px', margin: '20px', backgroundColor: '#f8d7da', color: 'red' }}>
                          <strong>Status Error:</strong> {statusError}
                        </div>
                      ) : (
                        <>
                          <h3>Status</h3>
                          <p style={{ color: 'gray', fontSize: '12px' }}>This is real-time data.</p>
                          {apiResponse?.updatedMessage ? (
                            <p>{apiResponse.updatedMessage}</p>
                          ) : (
                            <pre>
                              {responseFields.map(({ field, label }) => (
                                <div key={field}>
                                  <strong>{label}:</strong> {apiResponse ? apiResponse[field] : 'N/A'}
                                </div>
                              ))}
                            </pre>
                          )}
                        </>
                      )}
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <button
                        onClick={handleDelete}
                        style={{
                          marginTop: '20px',
                          padding: '20px 40px',
                          fontSize: '20px',
                          backgroundColor: apiRequest?.identifier && !apiResponse?.updatedMessage && apiResponse?.localChunkCount > 1 ? 'red' : 'gray',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          opacity: apiRequest?.identifier ? 1 : 0.5,
                          pointerEvents: apiRequest?.identifier && !apiResponse?.updatedMessage && apiResponse?.localChunkCount > 1 ? 'auto' : 'none',
                        }}
                        disabled={!apiRequest?.identifier || apiResponse?.localChunkCount <= 1 || !!apiResponse?.updatedMessage}
                      >
                        Delete
                      </button>
                      {!apiRequest?.identifier && (
                        <p style={{ fontSize: '12px', color: 'gray', marginTop: '10px' }}>
                          Identifier is required for deletion.
                        </p>
                      )}
                      {apiResponse?.localChunkCount === 1 && (
                        <p style={{ fontSize: '12px', color: 'gray', marginTop: '10px' }}>
                          The delete feature won't delete the last chunk of metadata.
                        </p>
                      )}
                      {apiResponse?.updatedMessage && (
                        <p style={{ fontSize: '12px', color: 'gray', marginTop: '10px' }}>
                          This artifact is outdated. Allow the cleanup manager to delete.
                        </p>
                      )}
                    </div>
                    <div style={{ flex: 1, marginLeft: '20px' }}>
                      <h3>Requested</h3>
                      <pre>
                        {requestFields.map(({ field, label, format }) => (
                          <div key={field}>
                            <strong>{label}:</strong> {apiRequest ? (format ? format(apiRequest[field]) : apiRequest[field]) : 'N/A'}
                          </div>
                        ))}
                      </pre>
                    </div>
                  </div>
                  <div style={{ marginTop: '20px', width: '100%' }}>
                    {metadataError ? (
                      <div style={{ border: '1px solid red', padding: '20px', margin: '20px', backgroundColor: '#f8d7da', color: 'red' }}>
                        <strong>Metadata Error:</strong> {metadataError}
                      </div>
                    ) : (
                      <>
                        <h3>Metadata</h3>
                        {apiRequest?.identifier ? (
                          <pre>
                            {metadataFields.map(({ field, label }) => (
                              <div key={field}>
                                <strong>{label}:</strong> {metadataResponse ? metadataResponse[field] : 'N/A'}
                              </div>
                            ))}
                          </pre>
                        ) : (
                          <p>No metadata for this service type: {apiRequest?.service}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', fontSize: '24px', marginTop: '20px' }}>
                  <p>No Row Selected</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DataTable;