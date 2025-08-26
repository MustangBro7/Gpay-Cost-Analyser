// utils/transformData.ts
export function transformData(transactions) {
    const groupMap = {};
  
    transactions.forEach(tx => {
      const { Classification, Amount } = tx;
      if (!groupMap[Classification]) {
        groupMap[Classification] = {
          name: Classification,
          value: 0,
          transactions: [],
        };
      }
  
      groupMap[Classification].value += parseFloat(Amount);
      groupMap[Classification].transactions.push(tx);
    });
  
    return Object.values(groupMap);
  }
  