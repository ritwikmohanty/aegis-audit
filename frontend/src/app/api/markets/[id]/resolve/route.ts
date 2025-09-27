import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const marketId = parseInt(params.id);
    const body = await request.json();
    const { outcome, oracleAddress } = body;

    // Validate required fields
    if (!outcome || !oracleAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (outcome !== 'Yes' && outcome !== 'No') {
      return NextResponse.json(
        { success: false, error: 'Invalid outcome' },
        { status: 400 }
      );
    }

    // In a real implementation, this would:
    // 1. Verify the oracle is authorized
    // 2. Check that the market has ended
    // 3. Create a transaction to call reportOutcome on the contract
    // 4. Return the transaction bytes for the oracle to sign
    // 5. Handle the transaction execution

    // Mock response
    const transactionData = {
      marketId,
      outcome,
      oracleAddress,
      transactionBytes: "mock_transaction_bytes_here",
    };

    return NextResponse.json({
      success: true,
      data: transactionData,
      message: 'Market resolved successfully',
    });
  } catch (error) {
    console.error('Error resolving market:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resolve market' },
      { status: 500 }
    );
  }
}
