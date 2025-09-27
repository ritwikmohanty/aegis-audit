import { NextRequest, NextResponse } from 'next/server';

// Mock data for demonstration
const mockMarkets = [
  {
    id: 0,
    question: "Will HBAR reach $0.10 by end of 2024?",
    creator: "0x1234...5678",
    endTime: Date.now() + 86400000, // 24 hours from now
    status: 'Active',
    outcome: 'Pending',
    yesTokenPool: "1000",
    noTokenPool: "800",
    collateralPool: "1800",
    yesToken: "0x1111...1111",
    noToken: "0x2222...2222",
  },
  {
    id: 1,
    question: "Will Bitcoin reach $100k by end of 2024?",
    creator: "0x8765...4321",
    endTime: Date.now() + 172800000, // 48 hours from now
    status: 'Active',
    outcome: 'Pending',
    yesTokenPool: "500",
    noTokenPool: "1200",
    collateralPool: "1700",
    yesToken: "0x3333...3333",
    noToken: "0x4444...4444",
  },
];

export async function GET(request: NextRequest) {
  try {
    // In a real implementation, this would query the deployed contracts
    // For now, we return mock data
    return NextResponse.json({
      success: true,
      data: mockMarkets,
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch markets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, endTime, oracle, initialCollateral } = body;

    // Validate required fields
    if (!question || !endTime || !oracle || !initialCollateral) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // In a real implementation, this would:
    // 1. Create a transaction to call createMarket on the contract
    // 2. Return the transaction bytes for the frontend to sign
    // 3. Handle the transaction execution

    const newMarket = {
      id: mockMarkets.length,
      question,
      creator: "0x0000...0000", // Would be the actual creator address
      endTime: new Date(endTime).getTime(),
      status: 'Active',
      outcome: 'Pending',
      yesTokenPool: initialCollateral,
      noTokenPool: initialCollateral,
      collateralPool: initialCollateral,
      yesToken: "0x5555...5555",
      noToken: "0x6666...6666",
    };

    mockMarkets.push(newMarket);

    return NextResponse.json({
      success: true,
      data: newMarket,
      message: 'Market created successfully',
    });
  } catch (error) {
    console.error('Error creating market:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create market' },
      { status: 500 }
    );
  }
}
