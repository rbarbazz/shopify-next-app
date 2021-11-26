import { Card, EmptyState } from '@shopify/polaris'
import type { NextPage } from 'next'

const Home: NextPage = () => {
  return (
    <Card sectioned>
      <EmptyState
        heading="This is a Shopify app"
        action={{ content: 'Click me' }}
        secondaryAction={{
          content: 'Learn more',
          url: 'https://help.shopify.com',
        }}
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>Hello world</p>
      </EmptyState>
    </Card>
  )
}

export default Home
