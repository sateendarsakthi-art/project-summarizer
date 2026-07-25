const SummaryCard = ({ data }) => {

  if (!data) return null;

  return (

    <div className="card">

      <h2>{data.filename}</h2>

      <pre>
        {data.summary}
      </pre>

    </div>

  );
};

export default SummaryCard;